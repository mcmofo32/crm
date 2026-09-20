import { BoarStatus } from "@/generated/prisma/client";

/** Sentinelwaarde voor "boarStatus nog niet ingesteld" — Prisma's `null` kan niet als gewone select-waarde in een URL/formulier meegegeven worden. */
export const BOAR_STATUS_NONE = "NONE" as const;

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

/**
 * Hex-kleuren (niet Tailwind-klassen) — als inline `style` toegepast, ook per
 * `<option>`, want Tailwind-klassen op een `<option>` worden door de meeste
 * browsers genegeerd in de opengeklapte lijst, inline `style` wel gebruikt
 * (zelfde aanpak als POLICY_STATUS_COLORS in policyLabels.ts).
 */
export const BOAR_STATUS_COLORS: Record<BoarStatus, { background: string; color: string }> = {
  NOG_CONTACTEREN: { background: "#fecaca", color: "#991b1b" },
  LEAD_DOORGEGEVEN: { background: "#fef08a", color: "#854d0e" },
  BOAR_IN_ORDE: { background: "#bbf7d0", color: "#166534" },
  GEEN_INTERESSE: { background: "#e2e8f0", color: "#334155" },
};
