import { GoalMetric, KpiMetric } from "@/generated/prisma/client";

export const GOAL_METRIC_LABELS: Record<GoalMetric, string> = {
  UNITS: "Eenheden",
  CUSTOMERS: "Klanten",
  CONVERSATIONS: "Gesprekken",
  ABV_SALES: "ABV verkoop",
  ABV_RG: "ABV RG",
};

/** Volgorde waarin de wekelijkse doelen op het dashboard getoond worden. */
export const GOAL_METRIC_ORDER: GoalMetric[] = [
  "UNITS",
  "CUSTOMERS",
  "CONVERSATIONS",
  "ABV_SALES",
  "ABV_RG",
];

export const KPI_METRIC_LABELS: Record<KpiMetric, string> = {
  CONVERSATIONS: "KPI Gesprekken",
  PRODUCTION: "KPI Productie",
  CALLING_SESSION: "KPI Belsessie",
  SEMINAR: "KPI Seminarie",
};

/** Volgorde waarin de jaarlijkse KPI's onder "Productie jaarlijks" getoond worden. */
export const KPI_METRIC_ORDER: KpiMetric[] = [
  "CONVERSATIONS",
  "PRODUCTION",
  "CALLING_SESSION",
  "SEMINAR",
];

export const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];
