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

export type WeekRange = {
  /** Volgnummer binnen het jaar, 0-based, chronologisch. */
  weekIndex: number;
  start: Date;
  /** Exclusieve bovengrens. */
  end: Date;
  /** Kalendermaand (1-12) waartoe deze week hoort — bepaald door haar donderdag (ISO 8601). */
  month: number;
};

function mondayOnOrBefore(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

/**
 * Alle ISO-weken (maandag t.e.m. zondag) van `year` — 52 of 53 stuks. Een
 * week hoort bij de kalendermaand van haar donderdag, net zoals ISO 8601
 * bepaalt bij welk jaar een week hoort. Gebruikt voor de "per week"-weergave
 * van de KPI-heatmap: er bestaat geen apart weekdoel, dus het maanddoel
 * wordt gelijk verdeeld over alle weken die tot die maand horen.
 */
export function isoWeeksOfYear(year: number): WeekRange[] {
  let start = mondayOnOrBefore(new Date(year, 0, 4));
  const weeks: WeekRange[] = [];
  let weekIndex = 0;
  while (true) {
    const thursday = new Date(start);
    thursday.setDate(thursday.getDate() + 3);
    if (thursday.getFullYear() !== year) break;
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({ weekIndex, start, end, month: thursday.getMonth() + 1 });
    start = end;
    weekIndex++;
  }
  return weeks;
}
