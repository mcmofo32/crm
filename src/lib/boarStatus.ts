import { BoarStatus } from "@/generated/prisma/client";

export const BOAR_STATUS_LABELS: Record<BoarStatus, string> = {
  NOG_CONTACTEREN: "Nog contacteren",
  LEAD_DOORGEGEVEN: "Lead doorgegeven",
  BOAR_IN_ORDE: "BOAR in orde",
  GEEN_INTERESSE: "Geen interesse",
};

/** Vaste volgorde waarin de statussen getoond worden in de keuzelijst. */
export const BOAR_STATUS_ORDER: BoarStatus[] = [
  "NOG_CONTACTEREN",
  "LEAD_DOORGEGEVEN",
  "BOAR_IN_ORDE",
  "GEEN_INTERESSE",
];
