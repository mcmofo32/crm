import { InsuranceCompany, PolicyStatus } from "@/generated/prisma/client";

export const INSURANCE_COMPANY_LABELS: Record<InsuranceCompany, string> = {
  VIVIUM: "Vivium",
  AXA: "AXA",
  DELA: "Dela",
  CREDIMO: "Credimo",
  ALLIANZ: "Allianz",
};

export const INSURANCE_COMPANY_ORDER: InsuranceCompany[] = [
  "VIVIUM",
  "AXA",
  "DELA",
  "CREDIMO",
  "ALLIANZ",
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

/**
 * Hex-kleuren (niet Tailwind-klassen) die zo dicht mogelijk de kleurcodering
 * van de oorspronkelijke Excel benaderen. Als inline `style` toegepast, ook
 * per `<option>` — Tailwind-klassen op een `<option>` worden door de meeste
 * browsers genegeerd in de opengeklapte lijst, inline `style` wel gebruikt.
 */
export const POLICY_STATUS_COLORS: Record<
  PolicyStatus,
  { background: string; color: string }
> = {
  OPGELADEN_WACHT_ACTIEF: { background: "#fed7aa", color: "#9a3412" },
  ACTIEF: { background: "#bbf7d0", color: "#166534" },
  UITBETAALD: { background: "#15803d", color: "#ffffff" },
  GEANNULEERD: { background: "#dc2626", color: "#ffffff" },
  BACKOFFICE: { background: "#7e22ce", color: "#ffffff" },
  POLIS_NOG_TEKENEN: { background: "#a16207", color: "#ffffff" },
  PROBLEEM_DOCUMENTEN: { background: "#1e293b", color: "#ffffff" },
  POLIS_NOG_OPMAKEN: { background: "#bae6fd", color: "#0c4a6e" },
  AFWACHTEND_EERSTE_PREMIE: { background: "#f9a8d4", color: "#831843" },
};
