import Link from "next/link";
import { ChevronLeft, ChevronRight, Target, PieChart } from "lucide-react";
import {
  getCompanyProductionGoalProgress,
  getCompanyProductionContributionsForTable,
  saveCompanyProductionGoalAction,
  saveCompanyProductionContributionsAction,
} from "@/lib/actions/production";
import type { LeadType } from "@/generated/prisma/client";
import { Avatar } from "@/components/Avatar";
import { FormToast } from "@/components/toast/FormToast";

const QUARTER_LABELS: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

const TYPE_TABS: { value: LeadType; label: string }[] = [
  { value: "FA", label: "Productie (FA)" },
  { value: "RG", label: "Recrutering (RG)" },
];

export default async function BedrijfsJaarplanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; type?: string }>;
}) {
  const { year: yearParam, type: typeParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  const leadType: LeadType = typeParam === "RG" ? "RG" : "FA";

  const [goalProgress, contributionUsers] = await Promise.all([
    getCompanyProductionGoalProgress(year, leadType),
    getCompanyProductionContributionsForTable(year, leadType),
  ]);

  const boundSaveGoal = saveCompanyProductionGoalAction.bind(null, year, leadType);
  const boundSaveContributions = saveCompanyProductionContributionsAction.bind(
    null,
    year,
    leadType,
    contributionUsers.map((u) => u.id)
  );

  function tabHref(type: LeadType) {
    return `/beheer/doelen/jaarplan?year=${year}&type=${type}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          <Target size={24} />
          Bedrijfsjaarplan
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Het bedrijfsbrede doel per kwartaal en de verdeling per medewerker
          — voedt de progressiebalk en het taartdiagram onderaan het
          dashboard. Los van de individuele maanddoelen die je bij{" "}
          <Link href="/beheer/doelen" className="underline hover:text-slate-700 dark:hover:text-slate-300">
            Doelen
          </Link>{" "}
          instelt.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {TYPE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={tabHref(tab.value)}
              className={`rounded-full px-4 py-1.5 ${
                leadType === tab.value
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/beheer/doelen/jaarplan?year=${year - 1}&type=${leadType}`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronLeft size={16} />
          </Link>
          <span className="min-w-16 text-center text-base font-medium text-slate-900 dark:text-slate-100">
            {year}
          </span>
          <Link
            href={`/beheer/doelen/jaarplan?year=${year + 1}&type=${leadType}`}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-medium text-slate-900 dark:text-slate-100">
          <Target size={18} />
          Doel per kwartaal
        </h2>
        {leadType === "RG" ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Recrutering is cumulatief: &quot;Groei dit kwartaal&quot; komt
            bovenop het beginaantal (hieronder) en de vorige kwartalen —
            &quot;Totaal&quot; is dus het streefaantal medewerkers op het
            einde van dat kwartaal. &quot;Gerealiseerd&quot; is het
            effectieve aantal op dat moment (geen kwartaalbedrag) en laat je
            leeg zolang een kwartaal nog niet (volledig) afgelopen is.
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &quot;Doel per maand&quot; is het doel per maand binnen dat
            kwartaal — het kwartaaltotaal wordt automatisch berekend (x3).
            &quot;Gerealiseerd&quot; laat je leeg zolang een kwartaal nog niet
            (volledig) afgelopen is.
          </p>
        )}
        <form key={`${year}-${leadType}`} action={boundSaveGoal} className="flex flex-col gap-3">
          <FormToast message="Jaarplan opgeslagen" />
          {leadType === "RG" && (
            <label className="flex max-w-xs flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Beginstand — aantal medewerkers bij start van {year}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="startingValue"
                defaultValue={goalProgress.startingValue ?? ""}
                className="w-32 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Periode</th>
                  <th className="px-3 py-3 font-medium">
                    {leadType === "RG" ? "Groei dit kwartaal" : "Doel per maand"}
                  </th>
                  <th className="px-3 py-3 font-medium">Totaal</th>
                  <th className="px-3 py-3 font-medium">Gerealiseerd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {goalProgress.quarters.map((q) => (
                  <tr key={q.quarter} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      {QUARTER_LABELS[q.quarter]}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`monthlyTarget_${q.quarter}`}
                        defaultValue={q.monthlyTarget || ""}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {q.totalTarget.toLocaleString("nl-BE")}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`actualUnits_${q.quarter}`}
                        defaultValue={q.actualUnits ?? ""}
                        placeholder="nog niet ingevuld"
                        className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-medium text-slate-900 dark:bg-slate-800/60 dark:text-slate-100">
                  <td className="px-4 py-2.5">Totaal {year}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">
                    {goalProgress.totalTarget.toLocaleString("nl-BE")}
                  </td>
                  <td className="px-3 py-2">
                    {goalProgress.totalActual.toLocaleString("nl-BE")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Jaarplan opslaan voor {year}
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-medium text-slate-900 dark:text-slate-100">
          <PieChart size={18} />
          Verdeling per medewerker
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {leadType === "RG"
            ? `Hoeveel medewerkers elke rekruteerder in ${year} aanbracht`
            : `Hoeveel eenheden elke medewerker in ${year} realiseerde`}{" "}
          — bepaalt ieders aandeel (%) in het taartdiagram op het dashboard.
          Leeg laten = geen bijdrage voor die medewerker in {year}.
        </p>
        <form
          key={`contrib-${year}-${leadType}`}
          action={boundSaveContributions}
          className="flex flex-col gap-3"
        >
          <FormToast message="Verdeling opgeslagen" />
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Naam</th>
                  <th className="px-3 py-3 font-medium">
                    {leadType === "RG" ? "Medewerkers" : "Eenheden"} in {year}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contributionUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} photoUrl={u.photoUrl} />
                        {u.name}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        name={`units_${u.id}`}
                        defaultValue={u.units ?? ""}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                ))}
                {contributionUsers.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Geen gebruikers gevonden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {contributionUsers.length > 0 && (
            <div>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
              >
                Verdeling opslaan voor {year}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
