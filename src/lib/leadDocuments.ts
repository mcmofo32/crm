import { LeadDocumentKind, LeadType } from "@/generated/prisma/client";

/** FA heeft 3 vaste documentvakken, RG (geen budgettering/portefeuille van toepassing) maar één. */
export const LEAD_DOCUMENT_KINDS_BY_LEAD_TYPE: Record<LeadType, LeadDocumentKind[]> = {
  FA: ["FA_FICHE", "BUDGETTERING", "PORTEFEUILLE"],
  RG: ["RG_FICHE"],
};

export const LEAD_DOCUMENT_KIND_LABELS: Record<LeadDocumentKind, string> = {
  FA_FICHE: "Fiche financiële analyse",
  BUDGETTERING: "Budgettering",
  PORTEFEUILLE: "Portefeuille",
  RG_FICHE: "Fiche RG",
};

export const LEAD_DOCUMENT_KIND_HINTS: Record<LeadDocumentKind, string> = {
  FA_FICHE: "PDF, Word of foto",
  BUDGETTERING: "Excel of Google Sheets",
  PORTEFEUILLE: "Excel of Google Sheets",
  RG_FICHE: "PDF, Word of foto",
};

/** Bij de FA-/RG-fiche mag ook een foto (bv. rechtstreeks met de telefoon van een papieren fiche) i.p.v. enkel PDF/Word. */
export const LEAD_DOCUMENT_KIND_ALLOWS_PHOTO: Record<LeadDocumentKind, boolean> = {
  FA_FICHE: true,
  BUDGETTERING: false,
  PORTEFEUILLE: false,
  RG_FICHE: true,
};

/** `accept`-attribuut voor de bestandskiezer — Google Sheets/Docs worden lokaal altijd als één van deze formaten geëxporteerd voor upload. */
export const LEAD_DOCUMENT_KIND_ACCEPT: Record<LeadDocumentKind, string> = {
  FA_FICHE:
    ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*",
  BUDGETTERING:
    ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  PORTEFEUILLE:
    ".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv",
  RG_FICHE:
    ".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*",
};

export const LEAD_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
