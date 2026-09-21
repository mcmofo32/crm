"use server";

import { revalidatePath } from "next/cache";
import { del, get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canAccessOwner } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { LeadDocumentKind } from "@/generated/prisma/client";
import { LEAD_DOCUMENT_KIND_LABELS } from "@/lib/leadDocuments";
import type ExcelJS from "exceljs";

/**
 * Documenten horen bij de lead zelf, niet bij een specifieke klantbeheer-
 * actie — wie deze lead/klant mag zien (canAccessOwner, zelfde grens als de
 * leadpagina) mag er dus ook documenten aan toevoegen/verwijderen, ongeacht
 * of hij daarnaast ook klantendata (producten/BOAR/dossierbeheerder) mag
 * aanpassen. Dat laatste blijft wel apart afgeschermd via canManageCustomerData.
 */
async function requireLeadDocumentAccess(leadId: string) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, deletedAt: true },
  });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(viewer, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  return { viewer, lead };
}

/** De (hoogstens 3) documenten van een lead/klant, voor het leadprofiel. */
export async function getLeadDocuments(leadId: string) {
  await requireLeadDocumentAccess(leadId);

  return prisma.leadDocument.findMany({
    where: { leadId },
    select: {
      id: true,
      kind: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });
}

/**
 * Slaat de metadata op nadat het bestand zelf al rechtstreeks vanuit de
 * browser naar Vercel Blob geüpload is (zie LeadDocumentSlot) — hier komt
 * enkel het resultaat van die upload binnen, nooit de bestandsinhoud zelf.
 * Een nieuwe upload in hetzelfde vak vervangt het vorige bestand.
 */
export async function saveLeadDocumentAction(params: {
  leadId: string;
  kind: LeadDocumentKind;
  fileName: string;
  fileUrl: string;
  downloadUrl: string;
  blobPathname: string;
  mimeType: string;
  fileSize: number;
}) {
  const { viewer, lead } = await requireLeadDocumentAccess(params.leadId);

  const existing = await prisma.leadDocument.findUnique({
    where: { leadId_kind: { leadId: lead.id, kind: params.kind } },
  });
  if (existing) {
    try {
      await del(existing.fileUrl);
    } catch (err) {
      console.error(
        "[leadDocuments] kon vorig bestand niet verwijderen uit Blob storage",
        err
      );
    }
  }

  await prisma.leadDocument.upsert({
    where: { leadId_kind: { leadId: lead.id, kind: params.kind } },
    create: {
      leadId: lead.id,
      kind: params.kind,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      downloadUrl: params.downloadUrl,
      blobPathname: params.blobPathname,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      uploadedById: viewer.id,
    },
    update: {
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      downloadUrl: params.downloadUrl,
      blobPathname: params.blobPathname,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      uploadedById: viewer.id,
    },
  });

  await logAudit({
    actorId: viewer.id,
    action: existing ? "lead.document_replaced" : "lead.document_uploaded",
    entityType: "Lead",
    entityId: lead.id,
    description: `Document "${params.fileName}" (${LEAD_DOCUMENT_KIND_LABELS[params.kind]}) ${existing ? "vervangen" : "toegevoegd"}`,
  });

  revalidatePath(`/leads/${lead.id}`);
}

export async function deleteLeadDocumentAction(
  leadId: string,
  kind: LeadDocumentKind
) {
  const { viewer, lead } = await requireLeadDocumentAccess(leadId);

  const doc = await prisma.leadDocument.findUnique({
    where: { leadId_kind: { leadId: lead.id, kind } },
  });
  if (!doc) throw new Error("Document niet gevonden");

  await del(doc.fileUrl);
  await prisma.leadDocument.delete({ where: { id: doc.id } });

  await logAudit({
    actorId: viewer.id,
    action: "lead.document_deleted",
    entityType: "Lead",
    entityId: lead.id,
    description: `Document "${doc.fileName}" (${LEAD_DOCUMENT_KIND_LABELS[kind]}) verwijderd`,
  });

  revalidatePath(`/leads/${lead.id}`);
}

export type LeadDocumentPreview =
  | { type: "pdf"; viewUrl: string }
  | { type: "image"; viewUrl: string }
  | { type: "html"; html: string }
  | { type: "unsupported"; reason: string };

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toLocaleDateString("nl-BE");
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("");
    }
    if ("result" in value) {
      return cellText(value.result as ExcelJS.CellValue);
    }
    if ("text" in value) {
      return String(value.text);
    }
    if ("error" in value) return `#${value.error}`;
    return "";
  }
  return String(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rendert (mogelijk meerdere) werkbladen als eenvoudige, alleen-lezen HTML-tabellen. */
function renderSheetsAsHtml(sheets: ExcelJS.Worksheet[]): string {
  const withData = sheets.filter((s) => s.actualRowCount > 0);
  if (withData.length === 0) {
    return "<p>Geen gegevens gevonden in dit bestand.</p>";
  }

  return withData
    .map((sheet) => {
      const rowsHtml: string[] = [];
      sheet.eachRow((row) => {
        const cellsHtml: string[] = [];
        for (let col = 1; col <= sheet.actualColumnCount; col++) {
          cellsHtml.push(`<td>${escapeHtml(cellText(row.getCell(col).value))}</td>`);
        }
        rowsHtml.push(`<tr>${cellsHtml.join("")}</tr>`);
      });
      const heading =
        withData.length > 1 ? `<h3>${escapeHtml(sheet.name)}</h3>` : "";
      return `${heading}<table class="lead-document-preview-table"><tbody>${rowsHtml.join("")}</tbody></table>`;
    })
    .join("");
}

/**
 * Bouwt een weergave op voor "bekijken" van een klantdocument zonder
 * download: PDF en foto's (bv. van de FA-fiche) worden rechtstreeks inline
 * getoond (native browserviewer via /api/lead-documents/[id]), Word (.docx)
 * wordt server-side naar HTML omgezet (mammoth), Excel/CSV naar een
 * HTML-tabel (exceljs) — voor oudere formaten (.doc/.xls) of iets anders
 * bestaat geen inline-weergave, dan blijft enkel downloaden over.
 */
export async function getLeadDocumentPreviewAction(
  leadId: string,
  kind: LeadDocumentKind
): Promise<LeadDocumentPreview> {
  const { lead } = await requireLeadDocumentAccess(leadId);

  const doc = await prisma.leadDocument.findUnique({
    where: { leadId_kind: { leadId: lead.id, kind } },
  });
  if (!doc) throw new Error("Document niet gevonden");

  if (doc.mimeType === "application/pdf") {
    return { type: "pdf", viewUrl: `/api/lead-documents/${doc.id}` };
  }
  if (doc.mimeType.startsWith("image/")) {
    return { type: "image", viewUrl: `/api/lead-documents/${doc.id}` };
  }

  const lowerName = doc.fileName.toLowerCase();
  const isDocx =
    doc.mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");
  const isXlsx =
    doc.mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerName.endsWith(".xlsx");
  const isCsv = doc.mimeType === "text/csv" || lowerName.endsWith(".csv");

  if (!isDocx && !isXlsx && !isCsv) {
    return {
      type: "unsupported",
      reason:
        "Weergave in de CRM wordt enkel ondersteund voor PDF, foto's, Word (.docx) en Excel (.xlsx/.csv) — download het bestand om het te bekijken.",
    };
  }

  const blob = await get(doc.blobPathname, { access: "private" });
  if (!blob || !blob.stream) {
    return { type: "unsupported", reason: "Bestand niet gevonden in opslag" };
  }
  const buffer = Buffer.from(await new Response(blob.stream).arrayBuffer());

  if (isDocx) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.convertToHtml(
      { buffer },
      { convertImage: mammoth.images.dataUri }
    );
    return { type: "html", html: result.value };
  }

  const ExcelJSModule = (await import("exceljs")).default;
  const workbook = new ExcelJSModule.Workbook();
  if (isCsv) {
    const { Readable } = await import("node:stream");
    const sheet = await workbook.csv.read(Readable.from(buffer));
    return { type: "html", html: renderSheetsAsHtml([sheet]) };
  }
  try {
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return {
      type: "unsupported",
      reason: "Kon dit Excel-bestand niet lezen voor weergave.",
    };
  }
  return { type: "html", html: renderSheetsAsHtml(workbook.worksheets) };
}
