import { IncentiveMetric } from "@/generated/prisma/client";

export const METRIC_LABELS: Record<IncentiveMetric, string> = {
  CLIENTS_WON: "Aantal klanten",
  UNITS: "Aantal eenheden",
  RG_MEETINGS: "Aantal RG-gesprekken",
  ACTIVITIES_COMPLETED: "Afgeronde contactmomenten",
};

export type IncentiveStatus = "upcoming" | "active" | "ended";

/** Vóór startDate is een incentive nog niet bezig, dus niet meteen "Afgelopen". */
export function getIncentiveStatus(
  startDate: Date,
  endDate: Date,
  now: Date = new Date()
): IncentiveStatus {
  if (now < startDate) return "upcoming";
  if (now > endDate) return "ended";
  return "active";
}

export const INCENTIVE_STATUS_LABELS: Record<IncentiveStatus, string> = {
  upcoming: "Binnenkort",
  active: "Actief",
  ended: "Afgelopen",
};
