import { EmploymentStatus } from "@/generated/prisma/client";

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  BEDIENDE: "Bediende",
  ZELFSTANDIGE: "Zelfstandige",
  ARBEIDER: "Arbeider",
  AMBTENAAR: "Ambtenaar",
};

/** Vaste volgorde waarin de statuten getoond worden in de keuzelijst. */
export const EMPLOYMENT_STATUS_ORDER: EmploymentStatus[] = [
  "BEDIENDE",
  "ZELFSTANDIGE",
  "ARBEIDER",
  "AMBTENAAR",
];
