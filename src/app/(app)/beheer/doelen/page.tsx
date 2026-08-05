import Link from "next/link";
import { Target, Settings2 } from "lucide-react";
import {
  getAllUserGoalsForTable,
  getCurrentGoalPeriodForInput,
  saveAllUserGoalsAction,
  setGoalPeriodAction,
} from "@/lib/actions/goals";
import { GOAL_METRIC_LABELS, GOAL_METRIC_ORDER } from "@/lib/goalLabels";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Avatar } from "@/components/Avatar";

export default async function DoelenPage() {
  const [users, period] = await Promise.all([
    getAllUserGoalsForTable(),
    getCurrentGoalPeriodForInput(),
  ]);

  const userIds = users.map((u) => u.id);
  const boundSaveGoals = saveAllUserGoalsAction.bind(null, userIds);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Target size={24} />
          Doelen
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Wekelijkse doelen per gebruiker, en de periode waartegen ze op het
          dashboard vergeleken worden.
        </p>
      </div>

      <form
        action={setGoalPeriodAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Periode begint op
          </span>
          <input
            type="date"
            name="periodStart"
            defaultValue={period.startDate}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Periode eindigt op
          </span>
          <input
            type="date"
            name="periodEnd"
            defaultValue={period.endDate}
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Periode toepassen voor iedereen
        </button>
      </form>

      <form action={boundSaveGoals} className="flex flex-col gap-3">
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3 font-medium">
                  Naam
                </th>
                {GOAL_METRIC_ORDER.map((metric) => (
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
                  {GOAL_METRIC_ORDER.map((metric) => (
                    <td key={metric} className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`goal_${u.id}_${metric}`}
                        defaultValue={u.targetByMetric.get(metric) ?? ""}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-center text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/beheer/doelen/${u.id}`}
                      title="Jaarlijkse KPI's instellen"
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
                    colSpan={GOAL_METRIC_ORDER.length + 2}
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
              Doelen opslaan
            </button>
          </div>
        )}
      </form>

      <p className="text-sm text-slate-400">
        De jaarlijkse KPI&apos;s (Productie jaarlijks) stel je per gebruiker in
        via het tandwiel-icoon — daar geef je ook de maandelijkse stand in.
      </p>

      <Link
        href="/beheer/doelen/productie"
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <Settings2 size={16} />
        Productiemaanden: datums en doelen per maand instellen
      </Link>
    </div>
  );
}
