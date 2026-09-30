import Link from "next/link";
import { ChevronLeft, ChevronRight, Target, PieChart } from "lucide-react";
import {
  getCompanyProductionGoalProgress,
  getCompanyProductionContributions,
  saveCompanyProductionGoalAction,
  getActiveEmployeeCount,
} from "@/lib/actions/production";
import type { LeadType } from "@/generated/prisma/client";
import { Avatar } from "@/components/Avatar";
import { FormToast } from "@/components/toast/FormToast";

const QUARTER_LABELS: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

const TYPE_TABS: { value: LeadType; label: string }[] = [
  { value: "FA", label: "Productie (FA)" },
  { value: "RG", label: "Rekrutering (RG)" },
];

export default async function BedrijfsJaarplanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; type?: string }>;
}) {
  const { year: yearParam, type: typeParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  const leadType: LeadType = typeParam === "RG" ? "RG" : "FA";

  const [goalProgress, contributions, activeEmployeeCount] = await Promise.all([
    getCompanyProductionGoalProgress(year, leadType),
    leadType === "RG"
      ? Promise.resolve(null)
      : getCompanyProductionContributions(year, leadType),
    leadType === "RG" ? getActiveEmployeeCount() : Promise.resolve(null),
  ]);

  const boundSaveGoal = saveCompanyProductionGoalAction.bind(null, year, leadType);

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
          {leadType === "RG" ? (
            <>
              Het bedrijfsbrede doel per kwartaal — voedt de progressiebalk
              onderaan het dashboard. &quot;Gerealiseerd&quot; is het live
              personeelsbestand, los van de individuele maanddoelen die je
              bij{" "}
              <Link href="/beheer/doelen" className="underline hover:text-slate-700 dark:hover:text-slate-300">
                Doelen
              </Link>{" "}
              instelt.
            </>
          ) : (
            <>
              Het bedrijfsbrede doel per kwartaal — voedt de progressiebalk en
              het taartdiagram onderaan het dashboard. &quot;Gerealiseerd&quot;
              en de verdeling per medewerker worden live berekend uit dezelfde
              productiecijfers als de{" "}
              <Link href="/productie" className="underline hover:text-slate-700 dark:hover:text-slate-300">
                Productie
              </Link>
              -pagina (inclusief eventuele correcties die je daar per
              medewerker/maand invoert), los van de individuele maanddoelen die
              je bij{" "}
              <Link href="/beheer/doelen" className="underline hover:text-slate-700 dark:hover:text-slate-300">
                Doelen
              </Link>{" "}
              instelt.
            </>
          )}
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
            &quot;Gerealiseerd&quot; is voortaan simpelweg het huidige, live
            personeelsbestand — dus niet hier in te vullen (de vroegere
            telling per nieuwe aanwerving bleek historisch onbetrouwbaar,
            oudere medewerkers hebben geen betrouwbare aanwervingsdatum).
            Vul per kwartaal rechtstreeks het streefaantal medewerkers in
            (het volledige personeelsbestand dat je tegen dat moment wil
            bereiken, bv. 38 tegen eind Q4) — geen &quot;groei&quot; meer,
            gewoon het concrete streefcijfer zelf.
            {activeEmployeeCount !== null && (
              <>
                {" "}
                Ter referentie: er zijn nu{" "}
                <strong>{activeEmployeeCount.toLocaleString("nl-BE")}</strong>{" "}
                actieve medewerkers.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            &quot;Doel per maand&quot; is het doel per maand binnen dat
            kwartaal — het kwartaaltotaal wordt automatisch berekend (x3).
            &quot;Gerealiseerd&quot; wordt live berekend uit de eenheden die
            in dat kwartaal effectief afgesloten zijn, dus niet hier in te
            vullen.
          </p>
        )}
        <form key={`${year}-${leadType}`} action={boundSaveGoal} className="flex flex-col gap-3">
          <FormToast message="Jaarplan opgeslagen" />
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Periode</th>
                  <th className="px-3 py-3 font-medium">
                    {leadType === "RG" ? "Streefaantal medewerkers" : "Doel per maand"}
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
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {q.actualUnits.toLocaleString("nl-BE")}
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

      {contributions && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-lg font-medium text-slate-900 dark:text-slate-100">
            <PieChart size={18} />
            Verdeling per medewerker
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {`Hoeveel eenheden elke medewerker in ${year} realiseerde`}{" "}
            — live berekend uit dezelfde cijfers als de{" "}
            <Link href="/productie" className="underline hover:text-slate-700 dark:hover:text-slate-300">
              Productie
            </Link>
            -pagina, bepaalt ieders aandeel (%) in het taartdiagram op het
            dashboard. Is iemand intussen niet meer bij het bedrijf, of klopt
            een cijfer niet, pas dat dan aan op de Productie-pagina zelf (per
            medewerker, per productiemaand) — dat wordt hier automatisch
            mee overgenomen.
          </p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Naam</th>
                  <th className="px-3 py-3 font-medium">Eenheden in {year}</th>
                  <th className="px-3 py-3 font-medium">Aandeel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contributions.rows.map((row) => (
                  <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Avatar name={row.name} photoUrl={row.photoUrl} />
                        {row.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {row.units.toLocaleString("nl-BE")}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.percent}%</td>
                  </tr>
                ))}
                {contributions.rows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                      Nog geen productie geregistreerd in {year}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
