import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarClock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { Role } from "@/generated/prisma/client";
import {
  getTeamWeekOverview,
  getCoachTeamOptions,
  type TeamWeekOverviewRow,
} from "@/lib/actions/production";

// Nooit cachen — dit moet elke keer de actuele stand van deze week tonen.
export const dynamic = "force-dynamic";

function formatWeekLabel(start: Date, end: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** Zelfde 100/60%-drempels als percentColor op het dashboard, voor de statuskleur bij Voortgang. */
function progressColor(percent: number | null) {
  if (percent === null) return "bg-slate-300";
  if (percent >= 100) return "bg-green-500";
  if (percent >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function ProgressBar({ percent }: { percent: number | null }) {
  const width = Math.max(0, Math.min(percent ?? 0, 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-full rounded-full bg-slate-100">
        <div
          className={`h-1.5 rounded-full ${progressColor(percent)}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-xs text-slate-500">
        {percent === null ? "—" : `${percent}%`}
      </span>
    </div>
  );
}

function TeamRow({ row }: { row: TeamWeekOverviewRow }) {
  return (
    <tr className={row.isCoach ? "bg-slate-50" : "hover:bg-slate-50"}>
      <td className="px-4 py-3 font-medium text-slate-900">
        {row.name}
        {row.isCoach && (
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            (coach)
          </span>
        )}
      </td>
      <td className="px-3 py-3 text-center text-slate-900">{row.faScheduled}</td>
      <td className="px-3 py-3 text-center text-slate-600">{row.faTarget || "—"}</td>
      <td className="px-3 py-3">
        <ProgressBar percent={row.faPercent} />
      </td>
      <td className="px-3 py-3 text-center text-slate-900">{row.agScheduled}</td>
    </tr>
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
  if (viewer.role !== Role.COACH && !isManager) redirect("/dashboard");

  const { weekOffset: weekOffsetParam, coachId: coachIdParam } = await searchParams;
  const weekOffset = weekOffsetParam ? Number(weekOffsetParam) || 0 : 0;

  const teamOptions = isManager ? await getCoachTeamOptions() : [];
  const selectedCoachId =
    viewer.role === Role.COACH
      ? viewer.id
      : coachIdParam && teamOptions.some((t) => t.coachId === coachIdParam)
      ? coachIdParam
      : teamOptions[0]?.coachId;

  const overview = selectedCoachId
    ? await getTeamWeekOverview(weekOffset, selectedCoachId)
    : null;

  const coachSuffix = isManager && selectedCoachId ? `&coachId=${selectedCoachId}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <CalendarClock size={20} />
            </span>
            Weekoverzicht team
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Financiële analyses &amp; adviesgesprekken, per teamlid.
          </p>
        </div>
        {overview && (
          <div className="flex items-center gap-3">
            <Link
              href={`/beheer/weekoverzicht?weekOffset=${weekOffset - 1}${coachSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-40 text-center text-base font-medium text-slate-900">
              {formatWeekLabel(overview.weekStart, overview.weekEnd)}
              {weekOffset === 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  (deze week)
                </span>
              )}
            </span>
            <Link
              href={`/beheer/weekoverzicht?weekOffset=${weekOffset + 1}${coachSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {isManager && teamOptions.length > 0 && (
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
        >
          <input type="hidden" name="weekOffset" value={weekOffset} />
          <Users size={17} className="text-slate-400" />
          <label className="text-sm text-slate-600">Team:</label>
          <select
            name="coachId"
            defaultValue={selectedCoachId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {teamOptions.map((t) => (
              <option key={t.coachId} value={t.coachId}>
                {t.teamName}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Bekijken
          </button>
        </form>
      )}

      {!overview ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-slate-400">
          Geen team gevonden.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="border-b border-slate-200">
                  <th rowSpan={2} className="px-4 py-2 text-left align-bottom font-medium">
                    Teamlid
                  </th>
                  <th colSpan={3} className="border-l border-slate-200 px-3 py-1.5 text-center font-medium">
                    Financiële analyse
                  </th>
                  <th colSpan={1} className="border-l border-slate-200 px-3 py-1.5 text-center font-medium">
                    Adviesgesprekken
                  </th>
                </tr>
                <tr className="border-b border-slate-200 text-left">
                  <th className="border-l border-slate-200 px-3 py-2 text-center font-medium">
                    Ingepland
                  </th>
                  <th className="px-3 py-2 text-center font-medium">Doel</th>
                  <th className="px-3 py-2 text-left font-medium">Voortgang</th>
                  <th className="border-l border-slate-200 px-3 py-2 text-center font-medium">
                    Ingepland
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.rows.map((row) => (
                  <TeamRow key={row.userId} row={row} />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
                  <td className="px-4 py-2.5">Team totaal</td>
                  <td className="px-3 py-2.5 text-center">{overview.totals.faScheduled}</td>
                  <td className="px-3 py-2.5 text-center">
                    {overview.totals.faTarget || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {overview.totals.faPercent === null ? "—" : `${overview.totals.faPercent}%`}
                  </td>
                  <td className="px-3 py-2.5 text-center">{overview.totals.agScheduled}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              Doel gehaald
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Op koers
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              Achterstand
            </span>
          </div>
        </>
      )}
    </div>
  );
}
