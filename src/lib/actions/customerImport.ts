"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LeadType, type ProductType } from "@/generated/prisma/client";
import { canAccessOwner, canManageCustomerData } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { logAudit } from "@/lib/audit";
import { ensureFunnelStages } from "@/lib/funnelStages";
import { createWonLeadRecord, findOwnLeadWithSamePhone } from "@/lib/actions/leads";
import { PRODUCT_TYPE_ORDER } from "@/lib/productTypes";

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

export type CustomerImportState = {
  error?: string;
  createdCount?: number;
  skipped?: { row: number; name: string; reason: string }[];
} | null;

/**
 * Leest een geüpload Excel-bestand (bv. gedownload vanuit Google Sheets) en
 * maakt er meteen klanten van, mét producten — dezelfde kernlogica als
 * "Klant toevoegen" (`createCustomerAction`), maar dan per rij uit het
 * bestand i.p.v. één keer via het formulier. Kolommen worden herkend op
 * naam (hoofdletterongevoelig), dus de kolomvolgorde maakt niet uit.
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
  const ownerId = (await canAccessOwner(user, requestedOwnerId))
    ? requestedOwnerId
    : user.id;

  // exceljs is een vrij groot pakket — enkel dynamisch inladen wanneer deze
  // actie effectief draait, i.p.v. het altijd mee te bundelen zodra iets
  // uit leads.ts geïmporteerd wordt (zelfde reden als de lazy googleapis-
  // import in googleCalendar.ts).
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { error: "Kon dit bestand niet lezen — is het een geldig .xlsx-bestand?" };
  }

  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) {
    return { error: "Geen gegevens gevonden in het bestand" };
  }

  const columnByHeader = new Map<string, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
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
    return {
      error:
        'Geen naamkolom gevonden — voorzie een kolom "Naam" (volledige naam) of aparte kolommen "Voornaam"/"Achternaam".',
    };
  }

  const productColumns: { type: ProductType; col: number }[] = [];
  for (const type of PRODUCT_TYPE_ORDER) {
    const col = findColumn(PRODUCT_COLUMN_ALIASES[type]);
    if (col) productColumns.push({ type, col });
  }

  await ensureFunnelStages(leadType);
  const wonStage = await prisma.funnelStage.findFirst({
    where: { leadType, isWon: true },
  });
  if (!wonStage) return { error: "Kon de klant-fase niet vinden" };

  const skipped: { row: number; name: string; reason: string }[] = [];
  let createdCount = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
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

    if (phone) {
      const existing = await findOwnLeadWithSamePhone(ownerId, phone);
      if (existing) {
        skipped.push({
          row: rowNumber,
          name: displayName,
          reason: `bestaat al (${existing.firstName} ${existing.lastName} heeft dit nummer al)`,
        });
        continue;
      }
    }

    try {
      await createWonLeadRecord({
        actorId: user.id,
        ownerId,
        leadType,
        wonStageId: wonStage.id,
        firstName,
        lastName,
        email,
        phone,
        source: "Bulk-import (Excel)",
        products,
        occurredAt,
      });
      createdCount++;
    } catch (err) {
      skipped.push({
        row: rowNumber,
        name: displayName,
        reason: err instanceof Error ? err.message : "onbekende fout",
      });
    }
  }

  if (createdCount > 0) {
    await logAudit({
      actorId: user.id,
      action: "lead.created",
      entityType: "Lead",
      entityId: "bulk",
      description: `${createdCount} klant(en) in bulk geïmporteerd vanuit Excel (${leadType})${
        skipped.length > 0 ? `, ${skipped.length} overgeslagen` : ""
      }`,
    });
  }

  revalidatePath("/leads");
  revalidatePath("/klanten");
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent");
  revalidatePath("/subagent/polissen");
  revalidatePath(`/funnel/${leadType}`);

  return { createdCount, skipped };
}
