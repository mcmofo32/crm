import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp, Users } from "lucide-react";
import {
  getProductionLeaderboard,
  getConversationsLeaderboard,
  getCurrentProductionMonth,
  getCurrentConversationsContext,
  getProductionStructureOptions,
  resolveProductionUserIds,
  setUserMonthlyGoalAction,
  setUserMonthlyActualAction,
} from "@/lib/actions/production";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { GoalMetric, Role } from "@/generated/prisma/client";
import { Position, PercentBadge } from "@/components/ProductionShared";
import { ProductionTable } from "@/components/ProductionTable";
import { ExportImageButton } from "@/components/ExportImageButton";

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

export default async function ProductiePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    year?: string;
    month?: string;
    structureId?: string;
  }>;
}) {
  const { tab, year: yearParam, month: monthParam, structureId } =
    await searchParams;
  const activeTab = tab === "gesprekken" ? "gesprekken" : "productie";

  const current = await getCurrentProductionMonth();
  const year = yearParam ? Number(yearParam) : current.year;
  const month = monthParam ? Number(monthParam) : current.month;
  const isCurrentMonth = year === current.year && month === current.month;
  const next = shiftMonth(year, month, 1);
  const prev = shiftMonth(year, month, -1);

  const viewer = await getEffectiveViewer();
  const canEditGoals = viewer ? canManageUsers(viewer) : false;
  const structureOptions = await getProductionStructureOptions();
  const scopeUserIds = await resolveProductionUserIds(structureId);

  const [productionRows, conversationsContext] =
    activeTab === "productie"
      ? await Promise.all([
          getProductionLeaderboard(year, month, scopeUserIds),
          null,
        ])
      : [null, await getCurrentConversationsContext()];
  const conversationsRows =
    activeTab === "gesprekken"
      ? await getConversationsLeaderboard(scopeUserIds)
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <TrendingUp size={24} />
            Cijfers
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Ranglijst van iedereen: gesprekken deze week, en productie per maand.
          </p>
        </div>
        <ExportImageButton
          targetId="cijfers-export-tabel"
          filename={`cijfers-${activeTab}`}
        />
      </div>

      <div className="flex gap-2 text-base">
        <Link
          href={`/productie?tab=productie${structureSuffix}`}
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "productie"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Productie
        </Link>
        <Link
          href={`/productie?tab=gesprekken${structureSuffix}`}
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "gesprekken"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Gesprekken
        </Link>
      </div>

      {viewer?.role === Role.COACH && (
        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <Users size={15} className="text-slate-400" />
          Je ziet jouw team en de volledige substructuur eronder.
        </p>
      )}

      {structureOptions.length > 0 && (
        <form
          method="GET"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
        >
          <input type="hidden" name="tab" value={activeTab} />
          <Users size={17} className="text-slate-400" />
          <label className="text-sm text-slate-600">Bekijk structuur:</label>
          <select
            name="structureId"
            defaultValue={structureId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Iedereen</option>
            {structureOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
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

      {activeTab === "productie" && productionRows && (
        <>
          <div className="flex items-center gap-3">
            <Link
              href={`/productie?tab=productie&year=${prev.year}&month=${prev.month}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-40 text-center text-base font-medium text-slate-900">
              Productiemaand {String(month).padStart(2, "0")}
              {isCurrentMonth && (
                <span className="ml-1.5 text-xs font-normal text-slate-400">
                  (huidige)
                </span>
              )}
            </span>
            <Link
              href={`/productie?tab=productie&year=${next.year}&month=${next.month}${structureSuffix}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronRight size={16} />
            </Link>
          </div>

          <ProductionTable
            key={`${year}-${month}`}
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
          />
          {canEditGoals && (
            <Link
              href="/beheer/doelen/productie"
              className="inline-flex w-fit items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              Begin-/einddatums van de productiemaanden instellen →
            </Link>
          )}
        </>
      )}

      {activeTab === "gesprekken" && conversationsRows && conversationsContext && (
        <>
          <p className="text-sm text-slate-400">
            Deze week: {formatDate(conversationsContext.weekStart)} –{" "}
            {formatDate(conversationsContext.weekEnd)} · doel afgeleid van het
            maandelijkse gesprekken-doel voor productiemaand{" "}
            {String(conversationsContext.month).padStart(2, "0")}
          </p>

          <div
            id="cijfers-export-tabel"
            className="overflow-x-auto rounded-lg border border-slate-200 bg-white"
          >
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
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
              <tbody className="divide-y divide-slate-100">
                {conversationsRows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <Position position={i + 1} />
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {row.name}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      {row.jobFunction ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-900">
                      {row.actual}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {row.target || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <PercentBadge percent={row.percent} />
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center font-medium ${
                        row.growth > 0
                          ? "text-green-600"
                          : row.growth < 0
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {row.growth > 0 ? `+${row.growth}` : row.growth}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {row.toBePlanned}
                    </td>
                  </tr>
                ))}
                {conversationsRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
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
        </>
      )}
    </div>
  );
}
