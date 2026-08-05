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

/** De 3 doelen die per productiemaand ingesteld worden (Productie-tab + Doelen > Productiemaanden). */
export const MONTHLY_GOAL_METRICS = [
  "UNITS",
  "CUSTOMERS",
  "CONVERSATIONS",
] as const satisfies readonly GoalMetric[];

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

/**
 * KPI's die manueel ingesteld/ingevoerd worden op de doelenpagina.
 * KPI Seminarie zit hier niet bij: die wordt automatisch berekend uit de
 * aanwezigheidsregistratie op Evenementen.
 */
export const MANUAL_KPI_METRIC_ORDER: KpiMetric[] = [
  "CONVERSATIONS",
  "PRODUCTION",
  "CALLING_SESSION",
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
