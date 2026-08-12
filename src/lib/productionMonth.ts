export type ProductionMonthConfigRow = {
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
};

/**
 * Bepaalt in welke productiemaand `date` valt: de ingestelde maand (uit
 * `getAllProductionMonthConfigs`) waar die datum binnenvalt, anders gewoon
 * de kalendermaand van `date`. Puur/synchroon, dus in een apart bestand i.p.v.
 * production.ts ("use server" staat enkel async server actions toe).
 */
export function resolveProductionMonth(
  date: Date,
  configs: ProductionMonthConfigRow[]
): { year: number; month: number } {
  const match = configs.find((c) => date >= c.startDate && date <= c.endDate);
  if (match) return { year: match.year, month: match.month };
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
