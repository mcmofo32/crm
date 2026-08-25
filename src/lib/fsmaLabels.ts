import type { FsmaModule, FsmaModuleStatus } from "@/generated/prisma/client";

export const FSMA_MODULE_ORDER: FsmaModule[] = [
  "M1_1",
  "M1_2",
  "M2_1",
  "M2_2",
  "M2_3",
  "M2_4",
  "M3_1",
  "M3_2",
  "M4",
];

export const FSMA_MODULE_LABELS: Record<FsmaModule, string> = {
  M1_1: "Module 1.1 — De verzekeringsmarkt en regelgeving van het contract",
  M1_2: "Module 1.2 — Diverse wetgevingen",
  M2_1: "Module 2.1 — BA-verzekeringen en rechtsbijstand",
  M2_2: "Module 2.2 — Verzekeringen motorrijtuigen en hulpverlening",
  M2_3: "Module 2.3 — Zaakverzekeringen",
  M2_4: "Module 2.4 — Persoonsverzekeringen andere dan levensverzekeringen",
  M3_1: "Module 3.1 — Toepasselijke wetgeving en financiële vakbekwaamheid",
  M3_2: "Module 3.2 — Witwaswetgeving, verzekeringsmarkt, pensioenstelsel en gedragsregels",
  M4: "Module 4 — Levensverzekeringen met beleggingscomponent",
};

export const FSMA_STATUS_ORDER: FsmaModuleStatus[] = [
  "OPLEIDING_TE_PLANNEN",
  "OPLEIDING_INGEPLAND",
  "OPLEIDING_AFGEROND",
  "EXAMEN_TE_PLANNEN",
  "EXAMEN_INGEPLAND",
  "AFGEROND",
];

export const FSMA_STATUS_LABELS: Record<FsmaModuleStatus, string> = {
  OPLEIDING_TE_PLANNEN: "Opleiding nog in te plannen",
  OPLEIDING_INGEPLAND: "Opleiding ingepland",
  OPLEIDING_AFGEROND: "Opleiding afgerond",
  EXAMEN_TE_PLANNEN: "Examen nog in te plannen",
  EXAMEN_INGEPLAND: "Examen ingepland",
  AFGEROND: "Afgerond",
};

/** Oplopend van "nog niet gestart" (rood) naar "helemaal klaar" (groen) — zelfde stijl als POLICY_STATUS_COLORS. */
export const FSMA_STATUS_COLORS: Record<FsmaModuleStatus, { background: string; color: string }> = {
  OPLEIDING_TE_PLANNEN: { background: "#fecaca", color: "#991b1b" },
  OPLEIDING_INGEPLAND: { background: "#fef08a", color: "#854d0e" },
  OPLEIDING_AFGEROND: { background: "#bfdbfe", color: "#1e40af" },
  EXAMEN_TE_PLANNEN: { background: "#fed7aa", color: "#9a3412" },
  EXAMEN_INGEPLAND: { background: "#ddd6fe", color: "#5b21b6" },
  AFGEROND: { background: "#bbf7d0", color: "#166534" },
};

export type FsmaModuleRow = { module: FsmaModule; status: FsmaModuleStatus };
