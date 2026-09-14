"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ActivityStatus, ActivityType, LeadStatus } from "@/generated/prisma/client";
import { canManageUsers } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { logAudit } from "@/lib/audit";
import { normalizeEmail, normalizePhone } from "@/lib/duplicateUtils";
import type ExcelJS from "exceljs";

async function requireImporter() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  // Zelfde grens als het verwijderen van een klant (canDeleteLeads): dit kan
  // een bestaande klant net zo goed uit "Klant" halen (rood = geen klant),
  // dus enkel Beheerder/Admin.
  if (!canManageUsers(viewer)) {
    throw new Error("Enkel Beheerder/Admin mogen leads in bulk bijwerken");
  }
  return viewer;
}

const NAME_HEADERS = ["NAAM", "NAME", "VOLLEDIGE NAAM"];
const FIRSTNAME_HEADERS = ["VOORNAAM", "FIRSTNAME", "FIRST NAME"];
const LASTNAME_HEADERS = ["ACHTERNAAM", "LASTNAME", "LAST NAME"];
const PHONE_HEADERS = ["NUMMER", "TELEFOON", "GSM", "PHONE", "TEL"];
const EMAIL_HEADERS = ["EMAIL", "E-MAIL"];
const NOTES_HEADERS = [
  "NOTITIES",
  "NOTES",
  "OPMERKING",
  "OPMERKINGEN",
  "RAPPORTERING",
  "COMMENTAAR",
  "BESCHRIJVING",
];

/** Zelfde aanpak als customerImport.ts: cel kan tekst, rich text of een formuleresultaat bevatten. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      return (obj.richText as { text: string }[]).map((r) => r.text).join("").trim();
    }
    if (typeof obj.text === "string") return obj.text.trim();
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

function normalizeHeader(value: unknown): string {
  return cellToString(value).toUpperCase();
}

/** Normaliseert een naam voor vergelijking: hoofdletterongevoelig, spaties genegeerd. */
function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Is deze cel "rood" gemarkeerd? Op kleurtoon (hue) gebaseerd i.p.v. enkel
 * "rood-kanaal domineert" — dat laatste bleek ook oranje ("Voicemail") en
 * geel te herkennen als rood, want die hebben óók een dominant rood-kanaal.
 * Hue is onafhankelijk van hoe licht/donker/verzadigd de kleur is, dus dit
 * herkent zowel een volle rode opvulling als een lichtrode/roze rij-highlight
 * (bv. conditional formatting), maar laat oranje (~20-45°) en geel (~45-65°)
 * er duidelijk buiten — enkel een smalle band rond zuiver rood (0°/360°).
 */
function isReddishFill(cell: ExcelJS.Cell): boolean {
  const fill = cell.fill;
  if (!fill || fill.type !== "pattern" || fill.pattern !== "solid") return false;
  const fgColor = fill.fgColor as { argb?: string } | undefined;
  const argb = fgColor?.argb;
  if (!argb || argb.length < 6) return false;
  const hex = argb.slice(-6);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.08) return false; // wit/grijs/zwart: nauwelijks kleurverschil

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;

  return hue >= 345 || hue <= 15;
}

function rowIsRed(row: ExcelJS.Row): boolean {
  let red = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (isReddishFill(cell)) red = true;
  });
  return red;
}

/**
 * Zoekt de kolomkoppenrij: meestal rij 1, maar scant de eerste 10 rijen op
 * een herkende kop i.p.v. blindelings rij 1 te nemen (zelfde reden als
 * customerImport.ts: een titelrij erboven zou anders alles laten mislukken).
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

type ExistingLead = {
  id: string;
  firstName: string;
  lastName: string;
  createdAt: Date;
  status: LeadStatus;
};

type ParsedRow = {
  sheet: string;
  row: number;
  name: string;
  matchedLeadId: string | null;
  matchedLeadName: string | null;
  matchedOn: "telefoon" | "email" | "naam" | null;
  skipReason: string | null;
  dateValue: Date | null;
  /** Ruwe tekst van de gelezen datumcel, vóór interpretatie — puur om in het voorbeeld te tonen wat er precies gelezen werd als het parsen toch faalt. */
  rawDateCell: string;
  currentCreatedAt: string | null;
  markLost: boolean;
  currentlyWon: boolean;
  notes: string | null;
};

/**
 * Leest en matcht elke rij tegen een bestaande lead — schrijft niets naar de
 * database. Wordt zowel voor het voorbeeld als (nog eens, op exact dezelfde
 * manier) vlak vóór het effectief toepassen gebruikt, zodat een rij die in
 * het voorbeeld "X wordt Y" toonde ook effectief zo toegepast wordt.
 */
async function parseAndMatch(file: File): Promise<
  | { error: string }
  | {
      rows: ParsedRow[];
      diagnostics: {
        sheet: string;
        headerRowNumber: number;
        dateColumnIndex: number;
        dateColumnHeader: string;
      }[];
    }
> {
  const ExcelJSModule = (await import("exceljs")).default;
  const workbook = new ExcelJSModule.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { error: "Kon dit bestand niet lezen — is het een geldig .xlsx-bestand?" };
  }

  const sheets = workbook.worksheets.filter((s) => s.rowCount >= 2);
  if (sheets.length === 0) return { error: "Geen gegevens gevonden in het bestand" };

  const existingLeads = await prisma.lead.findMany({
    where: { deletedAt: null },
    select: { id: true, firstName: true, lastName: true, phone: true, email: true, createdAt: true, status: true },
  });
  const byPhone = new Map<string, ExistingLead>();
  const byEmail = new Map<string, ExistingLead>();
  const byName = new Map<string, ExistingLead[]>();
  for (const lead of existingLeads) {
    const slim: ExistingLead = {
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      createdAt: lead.createdAt,
      status: lead.status,
    };
    const phone = normalizePhone(lead.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, slim);
    const email = normalizeEmail(lead.email);
    if (email && !byEmail.has(email)) byEmail.set(email, slim);
    const nameKey = normalizeName(`${lead.firstName} ${lead.lastName}`);
    const group = byName.get(nameKey);
    if (group) group.push(slim);
    else byName.set(nameKey, [slim]);
  }

  const rows: ParsedRow[] = [];
  const diagnostics: {
    sheet: string;
    headerRowNumber: number;
    dateColumnIndex: number;
    dateColumnHeader: string;
  }[] = [];

  for (const sheet of sheets) {
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
    // Voor de datumkolom: een héle kop exact laten matchen ("DATUM GEKREGEN")
    // bleek al bij een kleine variatie (bv. een andere formulering, of hoe
    // Google Sheets' "Tabel"-kolomkoppen exporteren) niets te vinden. Zoekt
    // daarom de eerste kolom waarvan de kop "DATUM" ergens bevat i.p.v. er
    // exact aan gelijk moet zijn — vindt zo "Datum", "Datum gekregen",
    // "Datum ontvangen", enz., ongeacht waar die kolom in het bestand staat.
    function findColumnContaining(fragment: string): number | null {
      for (const [header, col] of columnByHeader) {
        if (header.includes(fragment)) return col;
      }
      return null;
    }

    const fullNameCol = findColumn(NAME_HEADERS);
    const firstNameCol = findColumn(FIRSTNAME_HEADERS);
    const lastNameCol = findColumn(LASTNAME_HEADERS);
    const phoneCol = findColumn(PHONE_HEADERS);
    const emailCol = findColumn(EMAIL_HEADERS);
    const notesCol = findColumn(NOTES_HEADERS);
    // Laatste redmiddel als geen enkele kolomkop "datum" bevat: gewoon kolom
    // A zelf proberen — beter dan helemaal geen datum lezen.
    const dateCol = findColumnContaining("DATUM") ?? findColumnContaining("DATE") ?? 1;
    diagnostics.push({
      sheet: sheet.name,
      headerRowNumber,
      dateColumnIndex: dateCol,
      dateColumnHeader:
        cellToString(sheet.getRow(headerRowNumber).getCell(dateCol).value) || "(leeg)",
    });

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

      const phone = phoneCol ? cellToString(row.getCell(phoneCol).value) || null : null;
      const email = emailCol ? cellToString(row.getCell(emailCol).value) || null : null;
      const displayName = `${firstName} ${lastName}`.trim();
      if (!firstName && !phone && !email) continue; // lege rij

      const dateCellValue = row.getCell(dateCol).value;
      const dateValue = cellToDate(dateCellValue);
      const rawDateCell = cellToString(dateCellValue);
      const notesRaw = notesCol ? cellToString(row.getCell(notesCol).value) : "";
      const notes = notesRaw.trim() || null;
      const markLost = rowIsRed(row);

      const normalizedPhone = normalizePhone(phone);
      const normalizedEmail = normalizeEmail(email);
      let matched: ExistingLead | null = null;
      let matchedOn: ParsedRow["matchedOn"] = null;
      if (normalizedPhone && byPhone.has(normalizedPhone)) {
        matched = byPhone.get(normalizedPhone)!;
        matchedOn = "telefoon";
      } else if (normalizedEmail && byEmail.has(normalizedEmail)) {
        matched = byEmail.get(normalizedEmail)!;
        matchedOn = "email";
      } else if (displayName) {
        const candidates = byName.get(normalizeName(displayName));
        if (candidates?.length === 1) {
          matched = candidates[0];
          matchedOn = "naam";
        } else if (candidates && candidates.length > 1) {
          rows.push({
            sheet: sheet.name,
            row: rowNumber,
            name: displayName,
            matchedLeadId: null,
            matchedLeadName: null,
            matchedOn: null,
            skipReason: `naam komt bij ${candidates.length} leads voor (geen telefoon/email om te onderscheiden) — overgeslagen`,
            dateValue,
            rawDateCell,
            currentCreatedAt: null,
            markLost,
            currentlyWon: false,
            notes,
          });
          continue;
        }
      }

      if (!matched) {
        rows.push({
          sheet: sheet.name,
          row: rowNumber,
          name: displayName || phone || email || "(geen naam)",
          matchedLeadId: null,
          matchedLeadName: null,
          matchedOn: null,
          skipReason: "geen bestaande lead gevonden (telefoon, email en naam komen niet overeen)",
          dateValue,
          rawDateCell,
          currentCreatedAt: null,
          markLost,
          currentlyWon: false,
          notes,
        });
        continue;
      }

      const nothingToDo = !dateValue && !markLost && !notes;
      rows.push({
        sheet: sheet.name,
        row: rowNumber,
        name: displayName || `${matched.firstName} ${matched.lastName}`,
        matchedLeadId: matched.id,
        matchedLeadName: `${matched.firstName} ${matched.lastName}`,
        matchedOn,
        skipReason: nothingToDo ? "niets om aan te passen op deze rij" : null,
        dateValue,
        rawDateCell,
        currentCreatedAt: matched.createdAt.toISOString(),
        markLost,
        currentlyWon: matched.status === LeadStatus.WON,
        notes,
      });
    }
  }

  return { rows, diagnostics };
}

export type LeadsExcelUpdateState = {
  error?: string;
  mode?: "preview" | "committed";
  /** Welke kolom er per tabblad als datumkolom herkend werd — om te controleren of dat effectief de juiste is. */
  diagnostics?: {
    sheet: string;
    headerRowNumber: number;
    dateColumnIndex: number;
    dateColumnHeader: string;
  }[];
  matched?: {
    row: number;
    sheet: string;
    name: string;
    matchedLeadName: string;
    matchedOn: string;
    dateFrom: string | null;
    dateTo: string | null;
    /** Ruwe tekst van de gelezen datumcel — zodat zichtbaar is wat er gelezen werd, ook als dat niet als datum herkend kon worden. */
    rawDateCell: string;
    markLost: boolean;
    currentlyWon: boolean;
    notePreview: string | null;
  }[];
  unmatched?: { row: number; sheet: string; name: string; reason: string }[];
  appliedCount?: number;
  /** Grondwaarheid na het toepassen: wat er letterlijk in de database staat na elke update, rechtstreeks van de write zelf. */
  confirmed?: {
    row: number;
    sheet: string;
    name: string;
    matchedLeadName: string;
    dateAfterWrite: string;
    statusAfterWrite: string;
  }[];
  failed?: { row: number; sheet: string; name: string; reason: string }[];
} | null;

/**
 * Eén server-actie voor beide stappen: de "intent"-waarde (van welke knop
 * geklikt werd) bepaalt of dit enkel een voorbeeld toont (geen
 * databasewijzigingen) of de wijzigingen effectief doorvoert. Zo kan
 * hetzelfde bestand, nog steeds in dezelfde file-input, gewoon nog eens
 * opnieuw ingelezen worden voor de tweede stap.
 */
export async function updateLeadsFromExcelAction(
  _prevState: LeadsExcelUpdateState,
  formData: FormData
): Promise<LeadsExcelUpdateState> {
  const user = await requireImporter();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies een Excel-bestand (.xlsx)" };
  }
  const intent = String(formData.get("intent") ?? "preview");

  const parsed = await parseAndMatch(file);
  if ("error" in parsed) return { error: parsed.error };

  // "unmatched" vat hier zowel een rij zonder gevonden lead als een rij die
  // wél matchte maar niets te wijzigen had (geen datum/rood/notities) — een
  // matchedLeadId zonder skipReason is precies de "actionable" verzameling
  // hieronder, dus alles met een skipReason hoort hier, ongeacht de reden.
  const unmatched = parsed.rows
    .filter((r) => r.skipReason)
    .map((r) => ({ row: r.row, sheet: r.sheet, name: r.name, reason: r.skipReason! }));
  const actionable = parsed.rows.filter((r) => r.matchedLeadId && !r.skipReason);

  if (intent === "preview") {
    return {
      mode: "preview",
      diagnostics: parsed.diagnostics,
      matched: actionable.map((r) => ({
        row: r.row,
        sheet: r.sheet,
        name: r.name,
        matchedLeadName: r.matchedLeadName!,
        matchedOn: r.matchedOn!,
        dateFrom: r.currentCreatedAt,
        dateTo: r.dateValue ? r.dateValue.toISOString() : null,
        rawDateCell: r.rawDateCell,
        markLost: r.markLost,
        currentlyWon: r.currentlyWon,
        notePreview: r.notes,
      })),
      unmatched,
    };
  }

  const now = new Date();
  const failed: { row: number; sheet: string; name: string; reason: string }[] = [];
  // Ground truth: niet wat we DACHTEN te schrijven, maar wat er na de write
  // echt in de database staat (rechtstreeks van de update-call zelf) — zo
  // valt hier niets meer over te twijfelen, ook niet over caching elders.
  const confirmed: {
    row: number;
    sheet: string;
    name: string;
    matchedLeadName: string;
    dateAfterWrite: string;
    statusAfterWrite: string;
  }[] = [];
  let appliedCount = 0;

  for (const r of actionable) {
    try {
      const activityDate = r.dateValue ?? now;
      const updatedLead = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.update({
          where: { id: r.matchedLeadId! },
          data: {
            ...(r.dateValue ? { createdAt: r.dateValue } : {}),
            ...(r.markLost ? { status: LeadStatus.LOST } : {}),
          },
        });
        if (r.notes) {
          await tx.activity.create({
            data: {
              leadId: r.matchedLeadId!,
              assigneeId: user.id,
              type: ActivityType.NOTE,
              status: ActivityStatus.COMPLETED,
              subject: r.markLost
                ? "Rapportering uit Excel-import (gemarkeerd als geen klant)"
                : "Rapportering uit Excel-import",
              notes: r.notes,
              scheduledAt: activityDate,
              completedAt: activityDate,
            },
          });
        }
        return lead;
      });
      appliedCount++;
      confirmed.push({
        row: r.row,
        sheet: r.sheet,
        name: r.name,
        matchedLeadName: r.matchedLeadName!,
        dateAfterWrite: updatedLead.createdAt.toISOString(),
        statusAfterWrite: updatedLead.status,
      });
      revalidatePath(`/leads/${r.matchedLeadId}`);
    } catch (err) {
      failed.push({
        row: r.row,
        sheet: r.sheet,
        name: r.name,
        reason: err instanceof Error ? err.message : "onbekende fout",
      });
    }
  }

  if (appliedCount > 0) {
    await logAudit({
      actorId: user.id,
      action: "lead.bulkUpdatedFromExcel",
      entityType: "Lead",
      entityId: "bulk",
      description: `${appliedCount} lead(s) bijgewerkt vanuit Excel-import${
        failed.length > 0 ? `, ${failed.length} mislukt` : ""
      }`,
    });
  }

  revalidatePath("/klanten");
  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");

  return {
    mode: "committed",
    diagnostics: parsed.diagnostics,
    appliedCount,
    confirmed,
    failed,
    unmatched,
  };
}
