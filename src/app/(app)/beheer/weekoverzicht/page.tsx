import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { Role } from "@/generated/prisma/client";
import {
  getTeamWeekOverview,
  getCoachTeamOptions,
  type TeamWeekDailyRow,
} from "@/lib/actions/production";

// Nooit cachen — dit moet elke keer de actuele stand van deze week tonen.
export const dynamic = "force-dynamic";

function formatWeekLabel(start: Date, end: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function DailyBreakdownTable({
  title,
  dayLabels,
  rows,
}: {
  title: string;
  dayLabels: string[];
  rows: TeamWeekDailyRow[];
}) {
  const dayTotals = dayLabels.map((_, i) =>
    rows.reduce((sum, r) => sum + (r.counts[i] ?? 0), 0)
  );
  const grandTotal = dayTotals.reduce((sum, c) => sum + c, 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th
              colSpan={dayLabels.length + 2}
              className="px-4 py-2 text-left font-medium text-slate-700 dark:text-slate-300"
            >
              {title}
            </th>
          </tr>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="px-4 py-2 text-left font-medium">Teamlid</th>
            {dayLabels.map((label) => (
              <th
                key={label}
                className="border-l border-slate-200 px-3 py-2 text-center font-medium dark:border-slate-800"
              >
                {label}
              </th>
            ))}
            <th className="border-l border-slate-200 px-3 py-2 text-center font-medium dark:border-slate-800">
              Totaal
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => (
            <tr key={row.userId} className={row.isCoach ? "bg-slate-50 dark:bg-slate-800/60" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}>
              <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                {row.name}
                {row.isCoach && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                    (coach)
                  </span>
                )}
              </td>
              {row.counts.map((count, i) => (
                <td
                  key={i}
                  className="border-l border-slate-100 px-3 py-2.5 text-center text-slate-700 dark:border-slate-800 dark:text-slate-300"
                >
                  {count || <span className="text-slate-300 dark:text-slate-600">—</span>}
                </td>
              ))}
              <td className="border-l border-slate-200 px-3 py-2.5 text-center font-medium text-slate-900 dark:border-slate-800 dark:text-slate-100">
                {row.counts.reduce((s, c) => s + c, 0)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
            <td className="px-4 py-2.5">Team totaal</td>
            {dayTotals.map((count, i) => (
              <td key={i} className="border-l border-slate-700 px-3 py-2.5 text-center">
                {count}
              </td>
            ))}
            <td className="border-l border-slate-700 px-3 py-2.5 text-center">
              {grandTotal}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function WeekoverzichtPage({
  searchParams,
}: {
  searchParams: Promise<{ weekOffset?: string; coachId?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  const isManager = canManageUsers(viewer);

  const { weekOffset: weekOffsetParam, coachId: coachIdParam } = await searchParams;
  const weekOffset = weekOffsetParam ? Number(weekOffsetParam) || 0 : 0;

  const teamOptions = isManager ? await getCoachTeamOptions() : [];
  // Beheerder/Admin kiezen een team via de dropdown (of het eerste team bij
  // een ongeldige/lege keuze); een Coach ziet altijd zijn eigen team; een
  // gewone medewerker geeft geen coachId mee — getTeamWeekOverview lost zijn
  // team dan zelf op via zijn teamlidmaatschap.
  const selectedCoachId = isManager
    ? coachIdParam && teamOptions.some((t) => t.coachId === coachIdParam)
      ? coachIdParam
      : teamOptions[0]?.coachId
    : viewer.role === Role.COACH
    ? viewer.id
    : undefined;

  const overview = await getTeamWeekOverview(weekOffset, selectedCoachId);

  const coachSuffix = isManager && selectedCoachId ? `&coachId=${selectedCoachId}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <CalendarClock size={20} />
            </span>
            Weekoverzicht team
          </h1>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            Financiële analyses &amp; adviesgesprekken, per teamlid.
          </p>
        </div>
        {overview && (
          <div className="flex items-center gap-3">
            <Link
              href={`/beheer/weekoverzicht?weekOffset=${weekOffset - 1}${coachSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-40 text-center text-base font-medium text-slate-900 dark:text-slate-100">
              {formatWeekLabel(overview.weekStart, overview.weekEnd)}
              {weekOffset === 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                  (deze week)
                </span>
              )}
            </span>
            <Link
              href={`/beheer/weekoverzicht?weekOffset=${weekOffset + 1}${coachSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {isManager && teamOptions.length > 0 && (
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <input type="hidden" name="weekOffset" value={weekOffset} />
          <Users size={17} className="text-slate-400 dark:text-slate-500" />
          <label className="text-sm text-slate-600 dark:text-slate-400">Team:</label>
          <select
            name="coachId"
            defaultValue={selectedCoachId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {teamOptions.map((t) => (
              <option key={t.coachId} value={t.coachId}>
                {t.teamName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Bekijken
          </button>
        </form>
      )}

      {!overview ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
          Geen team gevonden.
        </div>
      ) : (
        <>
          <DailyBreakdownTable
            title="Financiële analyse — per dag"
            dayLabels={overview.dayLabels}
            rows={overview.faDaily}
          />
          <DailyBreakdownTable
            title="Adviesgesprekken — per dag"
            dayLabels={overview.dayLabels}
            rows={overview.agDaily}
          />
        </>
      )}
    </div>
  );
}
