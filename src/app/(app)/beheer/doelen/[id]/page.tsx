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

      <p className="text-sm text-slate-400">
        De 4 jaarlijkse KPI&apos;s (&ldquo;Jaarlijkse KPI&apos;s&rdquo;) zijn allemaal
        automatisch berekend, hier is niets manueel in te vullen. KPI
        Seminarie/Belsessie komen uit de aanwezigheidsregistratie op{" "}
        <Link href="/evenementen" className="underline hover:text-slate-600">
          Evenementen
        </Link>{" "}
        (enkel evenementen die een Beheerder/Admin achteraf bevestigd heeft
        tellen mee). KPI Productie/Gesprekken komen uit het behalen van het
        Eenheden- resp. Gesprekken-doel per productiemaand (zie het overzicht
        hieronder).
      </p>

      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-slate-900">
              Maandelijkse stand — {year}
            </h2>
            <p className="text-sm text-slate-500">
              ✓ = doel gehaald, ✗ = niet gehaald, — = maand nog niet
              afgelopen of geen doel ingesteld.
            </p>
          </div>
          <YearSwitcher basePath={`/beheer/doelen/${id}`} year={year} options={yearOptions} />
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
              <tr className="border-t border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                  {KPI_METRIC_LABELS.PRODUCTION}
                </td>
                {monthlyAchievements.map((m) => (
                  <td
                    key={m.month}
                    className="px-1 py-1 text-center text-sm text-slate-500"
                  >
                    {m.unitsAchieved === null ? "—" : m.unitsAchieved ? "✓" : "✗"}
                  </td>
                ))}
              </tr>
              <tr className="border-t border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-900 whitespace-nowrap">
                  {KPI_METRIC_LABELS.CONVERSATIONS}
                </td>
                {monthlyAchievements.map((m) => (
                  <td
                    key={m.month}
                    className="px-1 py-1 text-center text-sm text-slate-500"
                  >
                    {m.conversationsAchieved === null
                      ? "—"
                      : m.conversationsAchieved
                      ? "✓"
                      : "✗"}
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
