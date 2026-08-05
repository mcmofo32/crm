import Link from "next/link";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import {
  getProductionLeaderboard,
  getConversationsLeaderboard,
  getCurrentProductionMonth,
  setUserMonthlyGoalAction,
} from "@/lib/actions/production";
import { getCurrentGoalPeriod } from "@/lib/actions/goals";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { GoalMetric } from "@/generated/prisma/client";
import { Position, percentColor } from "@/components/ProductionShared";
import { ProductionTable } from "@/components/ProductionTable";

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
  searchParams: Promise<{ tab?: string; year?: string; month?: string }>;
}) {
  const { tab, year: yearParam, month: monthParam } = await searchParams;
  const activeTab = tab === "gesprekken" ? "gesprekken" : "productie";

  const current = await getCurrentProductionMonth();
  const year = yearParam ? Number(yearParam) : current.year;
  const month = monthParam ? Number(monthParam) : current.month;
  const isCurrentMonth = year === current.year && month === current.month;
  const next = shiftMonth(year, month, 1);
  const prev = shiftMonth(year, month, -1);

  const [productionRows, goalPeriod] =
    activeTab === "productie"
      ? await Promise.all([getProductionLeaderboard(year, month), null])
      : [null, await getCurrentGoalPeriod()];
  const conversationsRows =
    activeTab === "gesprekken" ? await getConversationsLeaderboard() : null;

  const viewer = await getEffectiveViewer();
  const canEditGoals = viewer ? canManageUsers(viewer) : false;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <TrendingUp size={24} />
          Productie
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Ranglijst van iedereen: gesprekken deze week, en productie per maand.
        </p>
      </div>

      <div className="flex gap-2 text-base">
        <Link
          href="/productie?tab=productie"
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "productie"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Productie
        </Link>
        <Link
          href="/productie?tab=gesprekken"
          className={`rounded-full px-4 py-1.5 ${
            activeTab === "gesprekken"
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-600 border border-slate-200"
          }`}
        >
          Gesprekken
        </Link>
      </div>

      {activeTab === "productie" && productionRows && (
        <>
          <div className="flex items-center gap-3">
            <Link
              href={`/productie?tab=productie&year=${prev.year}&month=${prev.month}`}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
            >
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-40 text-center text-base font-medium text-slate-900">
              Productiemaand {String(month).padStart(2, "0")}
            </span>
            {!isCurrentMonth ? (
              <Link
                href={`/productie?tab=productie&year=${next.year}&month=${next.month}`}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-100 text-slate-300">
                <ChevronRight size={16} />
              </span>
            )}
          </div>

          <ProductionTable
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

      {activeTab === "gesprekken" && conversationsRows && goalPeriod && (
        <>
          <p className="text-sm text-slate-400">
            Periode: {formatDate(goalPeriod.startDate)} –{" "}
            {formatDate(goalPeriod.endDate)}
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                    <td
                      className={`px-3 py-2.5 text-center font-medium ${percentColor(row.percent)}`}
                    >
                      {row.percent === null ? "—" : `${row.percent}%`}
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
            </table>
          </div>
        </>
      )}
    </div>
  );
}
