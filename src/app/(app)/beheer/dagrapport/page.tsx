import { redirect } from "next/navigation";
import Link from "next/link";
import { Newspaper, ChevronLeft, ChevronRight } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getDailyStageReport, type DailyStageFlow } from "@/lib/actions/dailyReport";
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

function toDateOnly(value: string | undefined): Date {
  if (value) {
    const parsed = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
}

function toDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDay(date: Date, delta: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Brussels",
  });
}

export default async function DagrapportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

  const { date: dateParam } = await searchParams;
  const date = toDateOnly(dateParam);
  const prev = shiftDay(date, -1);
  const next = shiftDay(date, 1);
  const isYesterday =
    toDateParam(date) ===
    toDateParam(
      (() => {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        y.setHours(0, 0, 0, 0);
        return y;
      })()
    );

  const report = await getDailyStageReport(date);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Newspaper size={26} />
          Dagrapport
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Hoeveel leads naar elke funnel-fase verhuisden op de gekozen dag —
          per team en per medewerker. Enkel zichtbaar voor Beheerder/Admin.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/beheer/dagrapport?date=${toDateParam(prev)}`}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft size={16} />
        </Link>
        <span className="min-w-64 text-center text-base font-medium capitalize text-slate-900">
          {formatDayLabel(date)}
          {isYesterday && (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              (gisteren)
            </span>
          )}
        </span>
        <Link
          href={`/beheer/dagrapport?date=${toDateParam(next)}`}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <ChevronRight size={16} />
        </Link>
      </div>

      <StageFlowSection title="FA" flow={report.fa} />
      <StageFlowSection title="RG" flow={report.rg} />
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
      <h2 className="text-xl font-medium text-slate-900">{title}</h2>

      {grandTotal > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">
            Totaal per fase vandaag
          </p>
          <BarList items={stageTotals} />
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-500">Per team</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
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
            <tbody className="divide-y divide-slate-100">
              {flow.rows.map((row) => (
                <tr key={row.teamName} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {row.teamName}
                  </td>
                  {flow.columns.map((col) => (
                    <td key={col.key} className="px-3 py-2.5 text-center text-slate-700">
                      {row.counts[col.key] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-900">
                    {row.total}
                  </td>
                </tr>
              ))}
              {flow.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={flow.columns.length + 2}
                    className="px-4 py-8 text-center text-slate-400"
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
          <p className="mb-2 text-sm font-medium text-slate-500">
            Per medewerker — iedereen die zelf een fase-wijziging deed
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
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
              <tbody className="divide-y divide-slate-100">
                {flow.byPerson.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {row.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{row.teamName}</td>
                    {flow.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2.5 text-center text-slate-700">
                        {row.counts[col.key] ?? 0}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-900">
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
