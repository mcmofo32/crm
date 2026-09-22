import { redirect } from "next/navigation";
import Link from "next/link";
import { Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import {
  getDailyStageReport,
  type DailyStageFlow,
  type DailyNewLeadsReport,
} from "@/lib/actions/dailyReport";
import { BarList, type BarListItem } from "@/components/analytics/BarList";

// Zelfde categorische kleuren als STAGE_COLORS op Analyse (al gevalideerd
// met de dataviz-skill) — hier lokaal herhaald i.p.v. geïmporteerd, zelfde
// conventie als de rest van deze codebase (elke pagina definieert die zelf).
const STAGE_COLORS = [
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#a21caf",
  "#c026d3",
  "#059669",
  "#d97706",
];

type RangeMode = "day" | "week" | "month" | "custom";

const RANGE_TABS: { key: RangeMode; label: string }[] = [
  { key: "day", label: "Dag" },
  { key: "week", label: "Week" },
  { key: "month", label: "Maand" },
  { key: "custom", label: "Periode" },
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDay(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function shiftMonthAnchor(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function dayRange(date: Date) {
  const start = startOfDay(date);
  return { start, end: shiftDay(start, 1) };
}

/** Maandag 00:00 t.e.m. de volgende maandag 00:00 van de week waarin `date` valt. */
function weekRange(date: Date) {
  const day = date.getDay(); // 0 = zondag
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = startOfDay(shiftDay(date, diffToMonday));
  return { start, end: shiftDay(start, 7) };
}

/** 1e t.e.m. de 1e van de volgende maand van de kalendermaand waarin `date` valt. */
function monthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  return { start, end: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
}

function formatDayLabel(date: Date) {
  const label = date.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Brussels",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Brussels",
  });
}

function formatMonthLabel(date: Date) {
  const label = date.toLocaleDateString("nl-BE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Brussels",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default async function DagrapportPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    date?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

  const {
    range: rangeParam,
    date: dateParam,
    start: startParam,
    end: endParam,
  } = await searchParams;
  const mode: RangeMode =
    rangeParam === "week" || rangeParam === "month" || rangeParam === "custom"
      ? rangeParam
      : "day";

  const today = startOfDay(new Date());
  const defaultYesterday = shiftDay(today, -1);

  let periodStart: Date;
  let periodEnd: Date;
  let label: string;
  let badge: string | null = null;
  let prevHref: string | null = null;
  let nextHref: string | null = null;

  if (mode === "week") {
    const anchor = parseDateParam(dateParam) ?? today;
    const { start, end } = weekRange(anchor);
    periodStart = start;
    periodEnd = end;
    label = `Week ${formatShortDate(start)} – ${formatShortDate(shiftDay(end, -1))}`;
    badge = weekRange(today).start.getTime() === start.getTime() ? "deze week" : null;
    prevHref = `/beheer/dagrapport?range=week&date=${toDateParam(shiftDay(start, -7))}`;
    nextHref = `/beheer/dagrapport?range=week&date=${toDateParam(shiftDay(start, 7))}`;
  } else if (mode === "month") {
    const anchor = parseDateParam(dateParam) ?? today;
    const { start, end } = monthRange(anchor);
    periodStart = start;
    periodEnd = end;
    label = formatMonthLabel(start);
    badge = monthRange(today).start.getTime() === start.getTime() ? "deze maand" : null;
    prevHref = `/beheer/dagrapport?range=month&date=${toDateParam(shiftMonthAnchor(start, -1))}`;
    nextHref = `/beheer/dagrapport?range=month&date=${toDateParam(shiftMonthAnchor(start, 1))}`;
  } else if (mode === "custom") {
    const customStart = startOfDay(parseDateParam(startParam) ?? shiftDay(today, -6));
    const customEndInput = startOfDay(parseDateParam(endParam) ?? today);
    // Verdedigend: een eind vóór het begin zou anders stilzwijgend een lege
    // periode opleveren (geen crash, maar wel verwarrend voor wie zich typt).
    const customEnd = customEndInput < customStart ? customStart : customEndInput;
    periodStart = customStart;
    periodEnd = shiftDay(customEnd, 1);
    label = `${formatShortDate(customStart)} – ${formatShortDate(customEnd)}`;
  } else {
    const anchor = parseDateParam(dateParam) ?? defaultYesterday;
    const { start, end } = dayRange(anchor);
    periodStart = start;
    periodEnd = end;
    label = formatDayLabel(start);
    badge = toDateParam(start) === toDateParam(defaultYesterday) ? "gisteren" : null;
    prevHref = `/beheer/dagrapport?date=${toDateParam(shiftDay(start, -1))}`;
    nextHref = `/beheer/dagrapport?date=${toDateParam(shiftDay(start, 1))}`;
  }

  const report = await getDailyStageReport(periodStart, periodEnd);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          <Newspaper size={26} />
          Dagrapport
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Hoeveel leads naar elke funnel-fase verhuisden in de gekozen
          periode — per team en per medewerker. Enkel zichtbaar voor
          Beheerder/Admin.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-base">
        {RANGE_TABS.map((t) => (
          <Link
            key={t.key}
            href={`/beheer/dagrapport?range=${t.key}`}
            className={`rounded-full px-4 py-1.5 ${
              mode === t.key
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {mode === "custom" ? (
        <form
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <input type="hidden" name="range" value="custom" />
          <div className="flex flex-col gap-1">
            <label className="text-slate-600 dark:text-slate-400">Van</label>
            <input
              type="date"
              name="start"
              defaultValue={toDateParam(periodStart)}
              required
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-600 dark:text-slate-400">Tot en met</label>
            <input
              type="date"
              name="end"
              defaultValue={toDateParam(shiftDay(periodEnd, -1))}
              required
              className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Tonen
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={prevHref ?? "#"}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-72 text-center text-base font-medium text-slate-900 dark:text-slate-100">
            {label}
            {badge && (
              <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                ({badge})
              </span>
            )}
          </span>
          <Link
            href={nextHref ?? "#"}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      )}

      <NewLeadsSection title="FA" report={report.newLeadsFa} />
      <StageFlowSection title="FA" flow={report.fa} />
      <NewLeadsSection title="RG" report={report.newLeadsRg} />
      <StageFlowSection title="RG" flow={report.rg} />
    </div>
  );
}

/** Hoeveel leads/aanbevelingen er die dag nieuw binnenkwamen — los van wat er nadien met hun fase gebeurde (zie StageFlowSection hieronder). */
function NewLeadsSection({
  title,
  report,
}: {
  title: string;
  report: DailyNewLeadsReport;
}) {
  const grandTotal = report.rows.reduce((sum, r) => sum + r.total, 0);

  const teamItems: BarListItem[] = report.rows.map((r, i) => ({
    key: r.teamName,
    label: r.teamName,
    value: r.total,
    displayValue: String(r.total),
    color: STAGE_COLORS[i % STAGE_COLORS.length],
  }));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">
        Ontvangen aanbevelingen — {title}
      </h2>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          Totaal nieuw toegevoegd vandaag: {grandTotal}
        </p>
        {grandTotal > 0 ? (
          <BarList items={teamItems} />
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">Geen nieuwe aanbevelingen op deze dag.</p>
        )}
      </div>

      {report.byPerson.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Per medewerker</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Medewerker</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  <th className="px-3 py-3 text-center font-medium">Aantal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.byPerson.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{row.teamName}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-900 dark:text-slate-100">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StageFlowSection({
  title,
  flow,
}: {
  title: string;
  flow: DailyStageFlow;
}) {
  const grandTotal = flow.rows.reduce((sum, r) => sum + r.total, 0);

  const stageTotals: BarListItem[] = flow.columns.map((col, i) => {
    const value = flow.rows.reduce((s, r) => s + (r.counts[col.key] ?? 0), 0);
    return {
      key: col.key,
      label: col.label,
      value,
      displayValue: String(value),
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">{title}</h2>

      {grandTotal > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
            Totaal per fase vandaag
          </p>
          <BarList items={stageTotals} />
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">Per team</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Team</th>
                {flow.columns.map((col) => (
                  <th key={col.key} className="px-3 py-3 text-center font-medium">
                    {col.label}
                  </th>
                ))}
                <th className="px-3 py-3 text-center font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {flow.rows.map((row) => (
                <tr key={row.teamName} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    {row.teamName}
                  </td>
                  {flow.columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-300">
                      {row.counts[col.key] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-900 dark:text-slate-100">
                    {row.total}
                  </td>
                </tr>
              ))}
              {flow.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={flow.columns.length + 2}
                    className="px-4 py-8 text-center text-slate-400 dark:text-slate-500"
                  >
                    Geen fase-wijzigingen op deze dag.
                  </td>
                </tr>
              )}
            </tbody>
            {flow.rows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
                  <td className="px-4 py-2.5">Totaal</td>
                  {flow.columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-center">
                      {flow.rows.reduce((s, r) => s + (r.counts[col.key] ?? 0), 0)}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center">{grandTotal}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {flow.byPerson.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Per medewerker — iedereen die zelf een fase-wijziging deed
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Medewerker</th>
                  <th className="px-4 py-3 font-medium">Team</th>
                  {flow.columns.map((col) => (
                    <th key={col.key} className="px-3 py-3 text-center font-medium">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium">Totaal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {flow.byPerson.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{row.teamName}</td>
                    {flow.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-300">
                        {row.counts[col.key] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-900 dark:text-slate-100">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
