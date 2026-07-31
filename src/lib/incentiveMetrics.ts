import { IncentiveMetric } from "@/generated/prisma/client";

export const METRIC_LABELS: Record<IncentiveMetric, string> = {
  CLIENTS_WON: "Aantal klanten",
  UNITS: "Aantal eenheden",
  RG_MEETINGS: "Aantal RG-gesprekken",
  ACTIVITIES_COMPLETED: "Afgeronde contactmomenten",
};
