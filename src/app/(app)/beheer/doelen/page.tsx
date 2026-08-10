import Link from "next/link";
import { ChevronLeft, ChevronRight, Target, Settings2 } from "lucide-react";
import {
  getAllUserMonthlyGoalsForTable,
  saveAllUserMonthlyGoalsAction,
  getCurrentProductionMonth,
} from "@/lib/actions/production";
import { GOAL_METRIC_LABELS, MONTHLY_GOAL_METRICS } from "@/lib/goalLabels";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Avatar } from "@/components/Avatar";

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export default async function DoelenPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;
  const current = await getCurrentProductionMonth();
  const year = yearParam ? Number(yearParam) : current.year;
  const month = monthParam ? Number(monthParam) : current.month;
  const isCurrentMonth = year === current.year && month === current.month;
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const users = await getAllUserMonthlyGoalsForTable(year, month);

  const userIds = users.map((u) => u.id);
  const boundSaveGoals = saveAllUserMonthlyGoalsAction.bind(
    null,
    userIds,
    year,
    month
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Target size={24} />
          Doelen
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Doelen per gebruiker voor de gekozen productiemaand. Eenheden,
          Klanten, Gesprekken, ABV verkoop en ABV RG geef je enkel hier door.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Link
          href={`/beheer/doelen?year=${prev.year}&month=${prev.month}`}
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
          href={`/beheer/doelen?year=${next.year}&month=${next.month}`}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
        >
          <ChevronRight size={16} />
        </Link>
      </div>

      <form
        key={`${year}-${month}`}
        action={boundSaveGoals}
        className="flex flex-col gap-3"
      >
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">
                  Naam
                </th>
                {MONTHLY_GOAL_METRICS.map((metric) => (
                  <th
                    key={metric}
                    className="whitespace-nowrap px-3 py-3 text-center font-medium"
                  >
                    {GOAL_METRIC_LABELS[metric]}
                  </th>
                ))}
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} />
                      <div className="flex flex-col leading-tight">
                        <span>{u.name}</span>
                        <span className="text-xs font-normal text-slate-400">
                          {ROLE_LABELS[u.role]}
                        </span>
                      </div>
                    </div>
                  </td>
                  {MONTHLY_GOAL_METRICS.map((metric) => (
                    <td key={metric} className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`monthlyGoal_${u.id}_${metric}`}
                        defaultValue={u.targetByMetric.get(metric) ?? ""}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-center text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/beheer/doelen/${u.id}`}
                      title="Jaarlijkse KPI's bekijken"
                      className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Settings2 size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={MONTHLY_GOAL_METRICS.length + 2}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    Geen gebruikers gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {users.length > 0 && (
          <div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
            >
              Doelen opslaan voor productiemaand {String(month).padStart(2, "0")}
            </button>
          </div>
        )}
      </form>

      <p className="text-sm text-slate-400">
        Het doel Gesprekken hierboven is een totaal voor de hele
        productiemaand — op de Productie-tab en het dashboard wordt dit
        automatisch verdeeld over het aantal weken in die maand, zodat je
        ziet hoeveel je die week moet inplannen. Eenheden, Klanten, ABV
        verkoop en ABV RG worden op het dashboard vergeleken tegen het volle
        maanddoel. De jaarlijkse KPI&apos;s (Productie jaarlijks) zijn
        allemaal automatisch — via het tandwiel-icoon zie je per gebruiker
        de maandelijkse stand.
      </p>

      <Link
        href="/beheer/doelen/productie"
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Settings2 size={16} />
        Productiemaanden: begin-/einddatums per maand instellen
      </Link>
    </div>
  );
}
