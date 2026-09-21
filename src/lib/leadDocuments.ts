import { LeadDocumentKind } from "@/generated/prisma/client";

export const LEAD_DOCUMENT_KIND_ORDER: LeadDocumentKind[] = [
  "FA_FICHE",
  "BUDGETTERING",
  "PORTEFEUILLE",
];

export const LEAD_DOCUMENT_KIND_LABELS: Record<LeadDocumentKind, string> = {
  FA_FICHE: "Fiche financiële analyse",
  BUDGETTERING: "Budgettering",
  PORTEFEUILLE: "Portefeuille",
};

export const LEAD_DOCUMENT_KIND_HINTS: Record<LeadDocumentKind, string> = {
  FA_FICHE: "PDF, Word of foto",
  BUDGETTERING: "Excel of Google Sheets",
  PORTEFEUILLE: "Excel of Google Sheets",
};

/** Bij de FA-fiche mag ook een foto (bv. rechtstreeks met de telefoon van een papieren fiche) i.p.v. enkel PDF/Word. */
export const LEAD_DOCUMENT_KIND_ALLOWS_PHOTO: Record<LeadDocumentKind, boolean> = {
  FA_FICHE: true,
  BUDGETTERING: false,
  PORTEFEUILLE: false,
};

/** `accept`-attribuut voor de bestandskiezer — Google Sheets/Docs worden lokaal altijd als één van deze formaten geëxporteerd voor upload. */
export const LEAD_DOCUMENT_KIND_ACCEPT: Record<LeadDocumentKind, string> = {
  FA_FICHE:
    ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*",
  BUDGETTERING:
    ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  PORTEFEUILLE:
    ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
};

export const LEAD_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
