import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Target } from "lucide-react";
import { getUserForGoals } from "@/lib/actions/goals";
import { getMonthlyGoalAchievements } from "@/lib/actions/production";
import { KPI_METRIC_LABELS, MONTH_LABELS } from "@/lib/goalLabels";
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

  const monthlyAchievements = await getMonthlyGoalAchievements(id, year);

  const yearOptions = [year - 1, year, year + 1];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/beheer/doelen"
          className="mb-2 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          <ArrowLeft size={15} />
          Terug naar overzicht
        </Link>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          <Target size={24} />
          Doelen — {user.name}
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          {ROLE_LABELS[user.role]}
        </p>
      </div>

      <p className="text-sm text-slate-400 dark:text-slate-500">
        De 4 jaarlijkse KPI&apos;s (&ldquo;Jaarlijkse KPI&apos;s&rdquo;) zijn allemaal
        automatisch berekend, hier is niets manueel in te vullen. KPI
        Seminarie/Belsessie komen uit de aanwezigheidsregistratie op{" "}
        <Link href="/evenementen" className="underline hover:text-slate-600 dark:hover:text-slate-300">
          Evenementen
        </Link>{" "}
        (enkel evenementen die een Beheerder/Admin achteraf bevestigd heeft
        tellen mee). KPI Productie/Gesprekken komen uit het behalen van het
        Eenheden- resp. Gesprekken-doel per productiemaand (zie het overzicht
        hieronder).
      </p>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              Maandelijkse stand — {year}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ✓ = doel gehaald, ✗ = niet gehaald, — = maand nog niet
              afgelopen of geen doel ingesteld (bij een doel van exact 0
              telt de maand als gehaald). Cijfertje eronder = behaald/doel.
            </p>
          </div>
          <YearSwitcher basePath={`/beheer/doelen/${id}`} year={year} options={yearOptions} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-medium">KPI</th>
                {MONTH_LABELS.map((label) => (
                  <th key={label} className="px-1.5 py-2 text-center font-medium">
                    {label.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap dark:text-slate-100">
                  {KPI_METRIC_LABELS.PRODUCTION}
                </td>
                {monthlyAchievements.map((m) => (
                  <td
                    key={m.month}
                    className="px-1 py-1 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    <div>
                      {m.unitsAchieved === null ? "—" : m.unitsAchieved ? "✓" : "✗"}
                    </div>
                    {m.unitsTarget !== null && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {m.unitsActual}/{m.unitsTarget}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap dark:text-slate-100">
                  {KPI_METRIC_LABELS.CONVERSATIONS}
                </td>
                {monthlyAchievements.map((m) => (
                  <td
                    key={m.month}
                    className="px-1 py-1 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    <div>
                      {m.conversationsAchieved === null
                        ? "—"
                        : m.conversationsAchieved
                        ? "✓"
                        : "✗"}
                    </div>
                    {m.conversationsTarget !== null && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {m.conversationsActual}/{m.conversationsTarget}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
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
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
              : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          }`}
        >
          {y}
        </Link>
      ))}
    </div>
  );
}
