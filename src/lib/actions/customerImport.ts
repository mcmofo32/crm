"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LeadType, type ProductType } from "@/generated/prisma/client";
import { canAccessOwner, canManageCustomerData } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { logAudit } from "@/lib/audit";
import { ensureFunnelStages } from "@/lib/funnelStages";
import { createWonLeadRecord, getAssignableUsers } from "@/lib/actions/leads";
import { normalizePhone } from "@/lib/actions/duplicates";
import { PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import type ExcelJS from "exceljs";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/** Herkende kolomkoppen (hoofdletterongevoelig) per producttype, gebaseerd op de gangbare afkortingen. */
const PRODUCT_COLUMN_ALIASES: Record<ProductType, string[]> = {
  PENSIOENSPAREN: ["PSP", "PENSIOENSPAREN"],
  LANGETERMIJNSPAREN: ["LTS", "LANGETERMIJNSPAREN"],
  BELEGGEN: ["BEL", "BELEGGEN"],
  DELA: ["DELA"],
  VAPZ: ["VAPZ"],
  IPT: ["IPT"],
  KINDERSPAREN: ["KS", "KINDERSPAREN"],
};

const NAME_HEADERS = ["NAAM", "NAME", "VOLLEDIGE NAAM"];
const FIRSTNAME_HEADERS = ["VOORNAAM", "FIRSTNAME", "FIRST NAME"];
const LASTNAME_HEADERS = ["ACHTERNAAM", "LASTNAME", "LAST NAME"];
const PHONE_HEADERS = ["NUMMER", "TELEFOON", "GSM", "PHONE", "TEL"];
const EMAIL_HEADERS = ["EMAIL", "E-MAIL"];
const DATE_HEADERS = ["DATUM", "DATE"];

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("");
    }
    if (typeof obj.text === "string") return obj.text;
    if ("result" in obj) return cellToString(obj.result);
  }
  return String(value).trim();
}

/** Herkent zowel een echte Excel-datumcel als tekst in DD/MM/JJ(JJ)-notatie. */
function cellToDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = cellToString(value);
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const date = new Date(year, Number(m) - 1, Number(d));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cellToAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const text = cellToString(value).replace(/[€\s]/g, "").replace(",", ".");
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeader(value: unknown): string {
  return cellToString(value).toUpperCase();
}

/**
 * Zoekt de rij met de kolomkoppen: meestal rij 1, maar een tabel die als
 * "Table"/structured range vanuit Google Sheets geëxporteerd is, staat soms
 * een rij lager (bv. door een titelrij of een naam-cel boven de tabel). Kijkt
 * de eerste 10 rijen af op een cel die op een herkende kolomkop lijkt (Naam/
 * Voornaam/Nummer/Email) i.p.v. blindelings rij 1 te nemen.
 */
function findHeaderRowNumber(sheet: ExcelJS.Worksheet): number {
  const knownHeaders = new Set([
    ...NAME_HEADERS,
    ...FIRSTNAME_HEADERS,
    ...LASTNAME_HEADERS,
    ...PHONE_HEADERS,
    ...EMAIL_HEADERS,
  ]);
  const maxScan = Math.min(sheet.rowCount, 10);
  for (let r = 1; r <= maxScan; r++) {
    let found = false;
    sheet.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      if (knownHeaders.has(normalizeHeader(cell.value))) found = true;
    });
    if (found) return r;
  }
  return 1;
}

/** Normaliseert een naam voor vergelijking: hoofdletterongevoelig, spaties genegeerd. */
function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export type CustomerImportState = {
  error?: string;
  createdCount?: number;
  skipped?: { row: number; name: string; reason: string }[];
  skippedSheets?: { sheet: string; reason: string }[];
} | null;

async function processSheet(
  sheet: ExcelJS.Worksheet,
  ownerId: string,
  actorId: string,
  leadType: LeadType,
  wonStageId: string
): Promise<{ created: number; skipped: { row: number; name: string; reason: string }[] }> {
  const headerRowNumber = findHeaderRowNumber(sheet);
  const columnByHeader = new Map<string, number>();
  sheet.getRow(headerRowNumber).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    columnByHeader.set(normalizeHeader(cell.value), colNumber);
  });

  function findColumn(headers: string[]): number | null {
    for (const h of headers) {
      const col = columnByHeader.get(h);
      if (col) return col;
    }
    return null;
  }

  const fullNameCol = findColumn(NAME_HEADERS);
  const firstNameCol = findColumn(FIRSTNAME_HEADERS);
  const lastNameCol = findColumn(LASTNAME_HEADERS);
  const phoneCol = findColumn(PHONE_HEADERS);
  const emailCol = findColumn(EMAIL_HEADERS);
  const dateCol = findColumn(DATE_HEADERS);

  if (!fullNameCol && !(firstNameCol && lastNameCol)) {
    const foundHeaders = [...columnByHeader.keys()].join(", ") || "geen enkele";
    return {
      created: 0,
      skipped: [
        {
          row: headerRowNumber,
          name: "",
          reason: `geen naamkolom gevonden op rij ${headerRowNumber} — voorzie een kolom "Naam" (volledige naam) of aparte kolommen "Voornaam"/"Achternaam". Herkende kolomkoppen op die rij: ${foundHeaders}`,
        },
      ],
    };
  }

  const productColumns: { type: ProductType; col: number }[] = [];
  for (const type of PRODUCT_TYPE_ORDER) {
    const col = findColumn(PRODUCT_COLUMN_ALIASES[type]);
    if (col) productColumns.push({ type, col });
  }

  const skipped: { row: number; name: string; reason: string }[] = [];
  let created = 0;

  // Eén keer alle bestaande telefoonnummers van deze eigenaar ophalen i.p.v.
  // findOwnLeadWithSamePhone per rij te laten herhalen (dat deed voorheen
  // zijn eigen volledige prisma.lead.findMany per rij — bij een bestand met
  // honderden rijen dus evenveel identieke queries). Wordt tijdens de loop
  // zelf bijgewerkt, zodat dubbels binnen hetzelfde bestand ook nog gevonden
  // worden.
  const existingOwnLeads = await prisma.lead.findMany({
    where: { ownerId, deletedAt: null, phone: { not: null } },
    select: { firstName: true, lastName: true, phone: true },
  });
  const ownPhoneMap = new Map<string, { firstName: string; lastName: string }>();
  for (const lead of existingOwnLeads) {
    const normalized = normalizePhone(lead.phone);
    if (normalized) ownPhoneMap.set(normalized, lead);
  }

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    if (row.cellCount === 0) continue;

    let firstName = "";
    let lastName = "";
    if (firstNameCol && lastNameCol) {
      firstName = cellToString(row.getCell(firstNameCol).value);
      lastName = cellToString(row.getCell(lastNameCol).value);
    } else if (fullNameCol) {
      const fullName = cellToString(row.getCell(fullNameCol).value);
      const spaceIndex = fullName.indexOf(" ");
      firstName = spaceIndex === -1 ? fullName : fullName.slice(0, spaceIndex);
      lastName = spaceIndex === -1 ? "" : fullName.slice(spaceIndex + 1).trim();
    }
    firstName = firstName.trim();
    lastName = lastName.trim();
    if (!firstName) continue; // lege rij

    const displayName = `${firstName} ${lastName}`.trim();
    const phone = phoneCol ? cellToString(row.getCell(phoneCol).value) || null : null;
    const email = emailCol ? cellToString(row.getCell(emailCol).value) || null : null;
    const occurredAt =
      (dateCol && cellToDate(row.getCell(dateCol).value)) || new Date();

    const products: { type: ProductType; amount: number; units: number }[] = [];
    for (const { type, col } of productColumns) {
      const amount = cellToAmount(row.getCell(col).value);
      if (amount > 0) products.push({ type, amount, units: 0 });
    }
    if (products.length === 0) {
      skipped.push({ row: rowNumber, name: displayName, reason: "geen producten met een bedrag" });
      continue;
    }

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone && ownPhoneMap.has(normalizedPhone)) {
      const existing = ownPhoneMap.get(normalizedPhone)!;
      skipped.push({
        row: rowNumber,
        name: displayName,
        reason: `bestaat al (${existing.firstName} ${existing.lastName} heeft dit nummer al)`,
      });
      continue;
    }

    try {
      await createWonLeadRecord({
        actorId,
        ownerId,
        leadType,
        wonStageId,
        firstName,
        lastName,
        email,
        phone,
        source: "Bulk-import (Excel)",
        products,
        occurredAt,
      });
      created++;
      if (normalizedPhone) ownPhoneMap.set(normalizedPhone, { firstName, lastName });
    } catch (err) {
      skipped.push({
        row: rowNumber,
        name: displayName,
        reason: err instanceof Error ? err.message : "onbekende fout",
      });
    }
  }

  return { created, skipped };
}

/**
 * Leest een geüpload Excel-bestand (bv. gedownload vanuit Google Sheets) en
 * maakt er meteen klanten van, mét producten — dezelfde kernlogica als
 * "Klant toevoegen" (`createCustomerAction`), maar dan per rij uit het
 * bestand i.p.v. één keer via het formulier. Kolommen worden herkend op
 * naam (hoofdletterongevoelig), dus de kolomvolgorde maakt niet uit.
 *
 * Heeft het bestand meerdere tabbladen (bv. één per medewerker), dan wordt
 * elk tabblad apart verwerkt: de tabbladnaam wordt vergeleken met de namen
 * van de medewerkers, en elke klant op dat tabblad krijgt automatisch die
 * medewerker als eigenaar — de "Medewerker"-keuze in het formulier is dan
 * enkel nog een terugvalwaarde voor een tabbladnaam die niet herkend wordt
 * (of voor een bestand met maar één tabblad).
 */
export async function importCustomersBulkAction(
  _prevState: CustomerImportState,
  formData: FormData
): Promise<CustomerImportState> {
  const user = await requireUser();
  if (!canManageCustomerData(user)) {
    return { error: "Enkel subagenten mogen klanten in bulk aanmaken" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies een Excel-bestand (.xlsx)" };
  }

  const leadType: LeadType =
    String(formData.get("leadType") ?? "FA") === "RG" ? "RG" : "FA";
  const requestedOwnerId = String(formData.get("ownerId") ?? user.id);
  const fallbackOwnerId = (await canAccessOwner(user, requestedOwnerId))
    ? requestedOwnerId
    : user.id;

  // exceljs is een vrij groot pakket — enkel dynamisch inladen wanneer deze
  // actie effectief draait, i.p.v. het altijd mee te bundelen zodra iets
  // uit leads.ts geïmporteerd wordt (zelfde reden als de lazy googleapis-
  // import in googleCalendar.ts).
  const ExcelJSModule = (await import("exceljs")).default;
  const workbook = new ExcelJSModule.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { error: "Kon dit bestand niet lezen — is het een geldig .xlsx-bestand?" };
  }

  const sheets = workbook.worksheets.filter((s) => s.rowCount >= 2);
  if (sheets.length === 0) {
    return { error: "Geen gegevens gevonden in het bestand" };
  }

  await ensureFunnelStages(leadType);
  const wonStage = await prisma.funnelStage.findFirst({
    where: { leadType, isWon: true },
  });
  if (!wonStage) return { error: "Kon de klant-fase niet vinden" };

  // Bij meerdere tabbladen wordt de eigenaar per tabblad afgeleid uit de
  // tabbladnaam i.p.v. steeds dezelfde (manueel gekozen) medewerker te
  // gebruiken — dat is precies waarom je dan in één keer het hele bestand
  // (met alle medewerkers samen) kan uploaden.
  const multiSheet = sheets.length > 1;
  const assignableUsers = multiSheet ? await getAssignableUsers() : [];

  const skipped: { row: number; name: string; reason: string }[] = [];
  const skippedSheets: { sheet: string; reason: string }[] = [];
  let createdCount = 0;

  for (const sheet of sheets) {
    let ownerId = fallbackOwnerId;
    if (multiSheet) {
      const normalized = normalizeName(sheet.name);
      const match = assignableUsers.find((u) => normalizeName(u.name) === normalized);
      if (!match) {
        skippedSheets.push({
          sheet: sheet.name,
          reason: "geen medewerker gevonden met deze naam — tabblad overgeslagen",
        });
        continue;
      }
      if (!(await canAccessOwner(user, match.id))) {
        skippedSheets.push({
          sheet: sheet.name,
          reason: `geen toegang tot medewerker "${match.name}" — tabblad overgeslagen`,
        });
        continue;
      }
      ownerId = match.id;
    }

    const result = await processSheet(sheet, ownerId, user.id, leadType, wonStage.id);
    createdCount += result.created;
    skipped.push(
      ...result.skipped.map((s) => (multiSheet ? { ...s, name: `${s.name} (${sheet.name})` } : s))
    );
  }

  if (createdCount > 0) {
    await logAudit({
      actorId: user.id,
      action: "lead.created",
      entityType: "Lead",
      entityId: "bulk",
      description: `${createdCount} klant(en) in bulk geïmporteerd vanuit Excel (${leadType})${
        skipped.length > 0 ? `, ${skipped.length} overgeslagen` : ""
      }${skippedSheets.length > 0 ? `, ${skippedSheets.length} tabblad(en) overgeslagen` : ""}`,
    });
  }

  revalidatePath("/leads");
  revalidatePath("/klanten");
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent");
  revalidatePath("/subagent/polissen");
  revalidatePath(`/funnel/${leadType}`);

  return { createdCount, skipped, skippedSheets };
}
