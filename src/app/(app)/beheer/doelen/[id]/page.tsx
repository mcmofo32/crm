import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target } from "lucide-react";
import {
  getUserForGoals,
  getUserGoals,
  getUserKpiMonthlyEntries,
  saveUserGoalsAction,
  saveUserKpiMonthlyEntriesAction,
} from "@/lib/actions/goals";
import {
  GOAL_METRIC_LABELS,
  GOAL_METRIC_ORDER,
  KPI_METRIC_LABELS,
  KPI_METRIC_ORDER,
  MONTH_LABELS,
} from "@/lib/goalLabels";
import { ROLE_LABELS } from "@/lib/roleLabels";

export default async function UserDoelenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const now = new Date();
  const year =
    yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : now.getFullYear();

  const user = await getUserForGoals(id);
  if (!user) notFound();

  const [{ goalByMetric, kpiGoalByMetricYear }, monthlyByMetricMonth] =
    await Promise.all([
      getUserGoals(id),
      getUserKpiMonthlyEntries(id, year),
    ]);

  const boundSaveGoals = saveUserGoalsAction.bind(null, id, year);
  const boundSaveMonthly = saveUserKpiMonthlyEntriesAction.bind(null, id, year);

  const yearOptions = [year - 1, year, year + 1];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/beheer/doelen"
          className="mb-2 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} />
          Terug naar overzicht
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Target size={24} />
          Doelen — {user.name}
        </h1>
        <p className="mt-1 text-base text-slate-500">
          {ROLE_LABELS[user.role]}
        </p>
      </div>

      <form
        action={boundSaveGoals}
        className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h2 className="text-lg font-medium text-slate-900">
            Wekelijkse doelen
          </h2>
          <p className="text-sm text-slate-500">
            Tonen bovenaan het dashboard, vergeleken met deze week.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {GOAL_METRIC_ORDER.map((metric) => (
            <label key={metric} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                {GOAL_METRIC_LABELS[metric]}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                name={`goal_${metric}`}
                defaultValue={goalByMetric.get(metric) ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>

        <hr className="border-slate-100" />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-slate-900">
              Jaarlijkse KPI-doelen — Productie jaarlijks
            </h2>
            <p className="text-sm text-slate-500">
              Doel per KPI voor het gekozen jaar.
            </p>
          </div>
          <YearSwitcher basePath={`/beheer/doelen/${id}`} year={year} options={yearOptions} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {KPI_METRIC_ORDER.map((metric) => (
            <label key={metric} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700">
                {KPI_METRIC_LABELS[metric]}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                name={`kpiGoal_${metric}`}
                defaultValue={kpiGoalByMetricYear.get(`${metric}:${year}`) ?? ""}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>

        <div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            Doelen opslaan
          </button>
        </div>
      </form>

      <form
        action={boundSaveMonthly}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <div>
          <h2 className="text-lg font-medium text-slate-900">
            Maandelijkse stand — {year}
          </h2>
          <p className="text-sm text-slate-500">
            De som van de 12 maanden vormt het jaarcijfer op het dashboard.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3 font-medium">KPI</th>
                {MONTH_LABELS.map((label) => (
                  <th key={label} className="px-1.5 py-2 text-center font-medium">
                    {label.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {KPI_METRIC_ORDER.map((metric) => (
                <tr key={metric} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                    {KPI_METRIC_LABELS[metric]}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <td key={month} className="px-1 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`monthly_${metric}_${month}`}
                        defaultValue={
                          monthlyByMetricMonth.get(`${metric}:${month}`) ?? ""
                        }
                        className="w-16 rounded-md border border-slate-300 px-1.5 py-1.5 text-center text-sm"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            Maandwaarden opslaan
          </button>
        </div>
      </form>
    </div>
  );
}

function YearSwitcher({
  basePath,
  year,
  options,
}: {
  basePath: string;
  year: number;
  options: number[];
}) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {options.map((y) => (
        <Link
          key={y}
          href={`${basePath}?year=${y}`}
          className={`rounded-md px-3 py-1.5 ${
            y === year
              ? "bg-slate-900 text-white"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {y}
        </Link>
      ))}
    </div>
  );
}
