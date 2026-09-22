import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp, Users } from "lucide-react";
import {
  getProductionLeaderboard,
  getConversationsLeaderboard,
  getRecommendationsLeaderboard,
  getCurrentProductionMonth,
  getCurrentProductionMonthRange,
  getCurrentConversationsContext,
  getProductionStructureOptions,
  resolveProductionUserIds,
  setUserMonthlyGoalAction,
  setUserMonthlyActualAction,
} from "@/lib/actions/production";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { GoalMetric } from "@/generated/prisma/client";
import { Position, PercentBadge } from "@/components/ProductionShared";
import { ProductionTable } from "@/components/ProductionTable";
import { ExportImageButton } from "@/components/ExportImageButton";
import { CijfersPosterHeader } from "@/components/CijfersPosterHeader";

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatWeekLabel(start: Date, end: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

/** Resterende dagen t.e.m. `end` (kalenderdagen), vandaag zelf inbegrepen. */
function daysRemainingInclusive(now: Date, end: Date) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffDays = Math.round(
    (startOfEndDay.getTime() - startOfToday.getTime()) / 86_400_000
  );
  return Math.max(0, diffDays + 1);
}

export default async function ProductiePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    year?: string;
    month?: string;
    weekOffset?: string;
    aYear?: string;
    aMonth?: string;
    structureId?: string;
  }>;
}) {
  const {
    tab,
    year: yearParam,
    month: monthParam,
    weekOffset: weekOffsetParam,
    aYear: aYearParam,
    aMonth: aMonthParam,
    structureId,
  } = await searchParams;
  const activeTab =
    tab === "gesprekken"
      ? "gesprekken"
      : tab === "aanbevelingen"
      ? "aanbevelingen"
      : "productie";

  const [current, viewer, structureOptions, scopeUserIds] = await Promise.all([
    getCurrentProductionMonth(),
    getEffectiveViewer(),
    getProductionStructureOptions(),
    resolveProductionUserIds(structureId),
  ]);
  const year = yearParam ? Number(yearParam) : current.year;
  const month = monthParam ? Number(monthParam) : current.month;
  const isCurrentMonth = year === current.year && month === current.month;
  const next = shiftMonth(year, month, 1);
  const prev = shiftMonth(year, month, -1);
  const weekOffset = weekOffsetParam ? Number(weekOffsetParam) || 0 : 0;
  // Eigen jaar/maand voor het Aanbevelingen-tabblad i.p.v. het Productie-
  // tabblad zijn `year`/`month` hergebruiken — anders verspringt Aanbevelingen
  // stilzwijgend mee zodra je enkel op Productie van maand wisselt.
  const aYear = aYearParam ? Number(aYearParam) : current.year;
  const aMonth = aMonthParam ? Number(aMonthParam) : current.month;
  const isCurrentAanbevelingenMonth = aYear === current.year && aMonth === current.month;
  const aNext = shiftMonth(aYear, aMonth, 1);
  const aPrev = shiftMonth(aYear, aMonth, -1);
  const canEditGoals = viewer ? canManageUsers(viewer) : false;

  const productionRows =
    activeTab === "productie"
      ? await getProductionLeaderboard(year, month, scopeUserIds)
      : null;
  // Enkel voor de huidige productiemaand: "resterende dagen" heeft geen
  // zinvolle betekenis bij het terugbladeren naar een afgelopen of nog niet
  // gestarte productiemaand.
  const daysRemaining =
    activeTab === "productie" && isCurrentMonth
      ? daysRemainingInclusive(new Date(), (await getCurrentProductionMonthRange()).endDate)
      : null;
  const [conversationsRows, conversationsContext] =
    activeTab === "gesprekken"
      ? await Promise.all([
          getConversationsLeaderboard(scopeUserIds, weekOffset),
          getCurrentConversationsContext(weekOffset),
        ])
      : [null, null];

  const recommendationsRows =
    activeTab === "aanbevelingen"
      ? await getRecommendationsLeaderboard(aYear, aMonth, scopeUserIds)
      : null;

  const conversationsTotals = conversationsRows
    ? (() => {
        const target = conversationsRows.reduce((s, r) => s + r.target, 0);
        const actual = conversationsRows.reduce((s, r) => s + r.actual, 0);
        return {
          target,
          actual,
          percent: target > 0 ? Math.round((actual / target) * 100) : null,
          growth: conversationsRows.reduce((s, r) => s + r.growth, 0),
          toBePlanned: conversationsRows.reduce((s, r) => s + r.toBePlanned, 0),
        };
      })()
    : null;

  const structureSuffix = structureId ? `&structureId=${structureId}` : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            <TrendingUp size={24} />
            Cijfers
          </h1>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            Ranglijst van iedereen: gesprekken deze week, en productie per maand.
          </p>
        </div>
        <ExportImageButton
          targetId="cijfers-export-tabel"
          filename={`cijfers-${activeTab}`}
        />
      </div>

      <div className="flex flex-wrap gap-2 text-base">
        <Link
          href={`/productie?tab=productie${structureSuffix}`}
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "productie"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
          }`}
        >
          Productie
        </Link>
        <Link
          href={`/productie?tab=gesprekken${structureSuffix}`}
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "gesprekken"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
          }`}
        >
          Gesprekken
        </Link>
        <Link
          href={`/productie?tab=aanbevelingen${structureSuffix}`}
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "aanbevelingen"
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "bg-white text-slate-600 border border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800"
          }`}
        >
          Aanbevelingen
        </Link>
      </div>

      {structureOptions.length > 0 && (
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
        >
          <input type="hidden" name="tab" value={activeTab} />
          <Users size={17} className="text-slate-400 dark:text-slate-500" />
          <label className="text-sm text-slate-600 dark:text-slate-400">Bekijk structuur:</label>
          <select
            name="structureId"
            defaultValue={structureId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {structureOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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

      {activeTab === "productie" && productionRows && (
        <>
          <div className="flex items-center gap-3">
            <Link
              href={`/productie?tab=productie&year=${prev.year}&month=${prev.month}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-40 text-center text-base font-medium text-slate-900 dark:text-slate-100">
              Productiemaand {String(month).padStart(2, "0")}
              {isCurrentMonth && (
                <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                  (huidige)
                </span>
              )}
            </span>
            <Link
              href={`/productie?tab=productie&year=${next.year}&month=${next.month}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRight size={16} />
            </Link>
          </div>

          <ProductionTable
            key={`${year}-${month}`}
            periodLabel={`Productiemaand ${String(month).padStart(2, "0")}/${year}${
              isCurrentMonth ? " (huidige)" : ""
            }`}
            rows={productionRows.map((row) => ({
              ...row,
              setCustomersGoal: setUserMonthlyGoalAction.bind(
                null,
                row.id,
                GoalMetric.CUSTOMERS,
                year,
                month
              ),
              setUnitsGoal: setUserMonthlyGoalAction.bind(
                null,
                row.id,
                GoalMetric.UNITS,
                year,
                month
              ),
              setCustomersActual: setUserMonthlyActualAction.bind(
                null,
                row.id,
                GoalMetric.CUSTOMERS,
                year,
                month
              ),
              setUnitsActual: setUserMonthlyActualAction.bind(
                null,
                row.id,
                GoalMetric.UNITS,
                year,
                month
              ),
            }))}
            canEditGoals={canEditGoals}
            daysRemaining={daysRemaining}
          />
          {canEditGoals && (
            <Link
              href="/beheer/doelen/productie"
              className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-300"
            >
              Begin-/einddatums van de productiemaanden instellen →
            </Link>
          )}
        </>
      )}

      {activeTab === "gesprekken" && conversationsRows && conversationsContext && (
        <>
          <div className="flex items-center gap-3">
            <Link
              href={`/productie?tab=gesprekken&weekOffset=${weekOffset - 1}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-48 text-center text-base font-medium text-slate-900 dark:text-slate-100">
              Week {formatWeekLabel(conversationsContext.weekStart, conversationsContext.weekEnd)}
              {weekOffset === 0 && (
                <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                  (huidige week)
                </span>
              )}
            </span>
            <Link
              href={`/productie?tab=gesprekken&weekOffset=${weekOffset + 1}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRight size={16} />
            </Link>
          </div>

          <p className="text-sm text-slate-400 dark:text-slate-500">
            {formatDate(conversationsContext.weekStart)} –{" "}
            {formatDate(conversationsContext.weekEnd)} · doel afgeleid van het
            maandelijkse gesprekken-doel voor productiemaand{" "}
            {String(conversationsContext.month).padStart(2, "0")}/
            {conversationsContext.year}
          </p>

          <div
            id="cijfers-export-tabel"
            className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <CijfersPosterHeader
              title="Cijfers — Gesprekken"
              subtitle={`Week: ${formatDate(conversationsContext.weekStart)} – ${formatDate(conversationsContext.weekEnd)}${weekOffset === 0 ? " (huidige week)" : ""}`}
            />
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Naam</th>
                  <th className="px-3 py-3 font-medium">Functie</th>
                  <th className="px-3 py-3 text-center font-medium">Behaald</th>
                  <th className="px-3 py-3 text-center font-medium">Doel</th>
                  <th className="px-3 py-3 text-center font-medium">% Doel</th>
                  <th className="px-3 py-3 text-center font-medium">Groei</th>
                  <th className="px-3 py-3 text-center font-medium">
                    In te plannen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {conversationsRows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2.5">
                      <Position position={i + 1} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.jobFunction ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100">
                      {row.actual}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                      {row.target || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PercentBadge percent={row.percent} />
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center font-medium ${
                        row.growth > 0
                          ? "text-green-600 dark:text-green-400"
                          : row.growth < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {row.growth > 0 ? `+${row.growth}` : row.growth}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                      {row.toBePlanned}
                    </td>
                  </tr>
                ))}
                {conversationsRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Geen gebruikers gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
              {conversationsRows.length > 0 && conversationsTotals && (
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
                    <td className="px-3 py-2.5" colSpan={3}>
                      Totaal
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {conversationsTotals.actual}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {conversationsTotals.target || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PercentBadge percent={conversationsTotals.percent} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {conversationsTotals.growth > 0
                        ? `+${conversationsTotals.growth}`
                        : conversationsTotals.growth}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {conversationsTotals.toBePlanned}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </>
      )}

      {activeTab === "aanbevelingen" && recommendationsRows && (
        <>
          <div className="flex items-center gap-3">
            <Link
              href={`/productie?tab=aanbevelingen&aYear=${aPrev.year}&aMonth=${aPrev.month}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-40 text-center text-base font-medium text-slate-900 dark:text-slate-100">
              Productiemaand {String(aMonth).padStart(2, "0")}
              {isCurrentAanbevelingenMonth && (
                <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">
                  (huidige)
                </span>
              )}
            </span>
            <Link
              href={`/productie?tab=aanbevelingen&aYear=${aNext.year}&aMonth=${aNext.month}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRight size={16} />
            </Link>
          </div>

          <p className="text-sm text-slate-400 dark:text-slate-500">
            Productiemaand {String(aMonth).padStart(2, "0")}/{aYear}
            {isCurrentAanbevelingenMonth && " (huidige)"}
          </p>

          <div
            id="cijfers-export-tabel"
            className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <CijfersPosterHeader
              title="Cijfers — Aanbevelingen"
              subtitle={`Productiemaand ${String(aMonth).padStart(2, "0")}/${aYear}${isCurrentAanbevelingenMonth ? " (huidige)" : ""}`}
            />
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Naam</th>
                  <th className="px-3 py-3 font-medium">Functie</th>
                  <th className="px-3 py-3 text-center font-medium">Doel FA-leads</th>
                  <th className="px-3 py-3 text-center font-medium">
                    Behaalde FA-leads
                  </th>
                  <th className="px-3 py-3 text-center font-medium">% Doel FA</th>
                  <th className="px-3 py-3 text-center font-medium">Doel RG-leads</th>
                  <th className="px-3 py-3 text-center font-medium">
                    Behaalde RG-leads
                  </th>
                  <th className="px-3 py-3 text-center font-medium">% Doel RG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recommendationsRows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="px-3 py-2.5">
                      <Position position={i + 1} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.jobFunction ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                      {row.targetFaLeads || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100">
                      {row.actualFaLeads}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PercentBadge
                        percent={
                          row.targetFaLeads > 0
                            ? Math.round((row.actualFaLeads / row.targetFaLeads) * 100)
                            : null
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-400">
                      {row.targetRgLeads || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-900 dark:text-slate-100">
                      {row.actualRgLeads}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PercentBadge
                        percent={
                          row.targetRgLeads > 0
                            ? Math.round((row.actualRgLeads / row.targetRgLeads) * 100)
                            : null
                        }
                      />
                    </td>
                  </tr>
                ))}
                {recommendationsRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Geen gebruikers gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
              {recommendationsRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
                    <td className="px-3 py-2.5" colSpan={3}>
                      Totaal
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {recommendationsRows.reduce((s, r) => s + r.targetFaLeads, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {recommendationsRows.reduce((s, r) => s + r.actualFaLeads, 0)}
                    </td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-center">
                      {recommendationsRows.reduce((s, r) => s + r.targetRgLeads, 0)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {recommendationsRows.reduce((s, r) => s + r.actualRgLeads, 0)}
                    </td>
                    <td className="px-3 py-2.5"></td>
                  </tr>
                </tfoot>
              )}
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
