import { InsuranceCompany, PolicyStatus } from "@/generated/prisma/client";

export const INSURANCE_COMPANY_LABELS: Record<InsuranceCompany, string> = {
  VIVIUM: "Vivium",
  AXA: "AXA",
  DELA: "Dela",
  CREDIMO: "Credimo",
};

export const INSURANCE_COMPANY_ORDER: InsuranceCompany[] = [
  "VIVIUM",
  "AXA",
  "DELA",
  "CREDIMO",
];

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  OPGELADEN_WACHT_ACTIEF: "Opgeladen wacht actief",
  ACTIEF: "Actief",
  UITBETAALD: "Uitbetaald",
  GEANNULEERD: "Geannuleerd",
  BACKOFFICE: "Backoffice",
  POLIS_NOG_TEKENEN: "Polis nog tekenen",
  PROBLEEM_DOCUMENTEN: "Probleem documenten",
  POLIS_NOG_OPMAKEN: "Polis nog opmaken",
  AFWACHTEND_EERSTE_PREMIE: "Afwachtend eerste premie",
};

/** Vaste volgorde, zelfde als de dropdown in de oorspronkelijke Excel. */
export const POLICY_STATUS_ORDER: PolicyStatus[] = [
  "OPGELADEN_WACHT_ACTIEF",
  "ACTIEF",
  "UITBETAALD",
  "GEANNULEERD",
  "BACKOFFICE",
  "POLIS_NOG_TEKENEN",
  "PROBLEEM_DOCUMENTEN",
  "POLIS_NOG_OPMAKEN",
  "AFWACHTEND_EERSTE_PREMIE",
];

/** Tailwind-klassen die zo dicht mogelijk de kleurcodering van de oorspronkelijke Excel benaderen. */
export const POLICY_STATUS_CLASSES: Record<PolicyStatus, string> = {
  OPGELADEN_WACHT_ACTIEF: "bg-orange-100 text-orange-800",
  ACTIEF: "bg-green-100 text-green-800",
  UITBETAALD: "bg-green-700 text-white",
  GEANNULEERD: "bg-red-600 text-white",
  BACKOFFICE: "bg-purple-700 text-white",
  POLIS_NOG_TEKENEN: "bg-yellow-700 text-white",
  PROBLEEM_DOCUMENTEN: "bg-slate-800 text-white",
  POLIS_NOG_OPMAKEN: "bg-sky-200 text-sky-900",
  AFWACHTEND_EERSTE_PREMIE: "bg-pink-300 text-pink-900",
};
