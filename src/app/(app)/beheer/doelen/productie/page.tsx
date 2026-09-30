import Link from "next/link";
import { Target, CalendarRange, Table2 } from "lucide-react";
import {
  getProductionMonthsForYear,
  saveProductionMonthDatesAction,
  getUserMonthlyActualsMatrix,
  setUserMonthlyActualAction,
  resetUserYearActualsAction,
} from "@/lib/actions/production";
import { GoalMetric, type LeadType } from "@/generated/prisma/client";
import { FormToast } from "@/components/toast/FormToast";
import { UserMonthlyActualsMatrix } from "@/components/UserMonthlyActualsMatrix";

const TYPE_TABS: { value: LeadType; label: string }[] = [
  { value: "FA", label: "Productie (FA)" },
  { value: "RG", label: "Rekrutering (RG)" },
];

export default async function ProductieDoelenPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; type?: string }>;
}) {
  const { year: yearParam, type: typeParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  const leadType: LeadType = typeParam === "RG" ? "RG" : "FA";
  const metric = leadType === "RG" ? GoalMetric.CUSTOMERS : GoalMetric.UNITS;

  const [months, matrixRows] = await Promise.all([
    getProductionMonthsForYear(year),
    getUserMonthlyActualsMatrix(year, leadType),
  ]);
  const boundSaveDates = saveProductionMonthDatesAction.bind(null, year);
  const matrixTableRows = matrixRows.map((row) => ({
    ...row,
    actionsByMonth: row.valuesByMonth.map((_, i) =>
      setUserMonthlyActualAction.bind(null, row.userId, metric, year, i + 1)
    ),
    resetYear: resetUserYearActualsAction.bind(null, row.userId, metric, year),
  }));

  function typeHref(type: LeadType) {
    return `/beheer/doelen/productie?year=${year}&type=${type}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          <Target size={24} />
          Productiemaanden
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Stel voor elk van de 12 productiemaanden de begin- en einddatum in
          (hoeft niet gelijk te lopen met de kalendermaand). De doelen per
          medewerker per productiemaand stel je in bij{" "}
          <Link href="/beheer/doelen" className="underline hover:text-slate-700 dark:hover:text-slate-300">
            Doelen
          </Link>
          .
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-medium text-slate-900 dark:text-slate-100">
          <CalendarRange size={18} />
          Datums per productiemaand
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/beheer/doelen/productie?year=${year - 1}&type=${leadType}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {year - 1}
          </Link>
          <span className="font-medium text-slate-900 dark:text-slate-100">{year}</span>
          <Link
            href={`/beheer/doelen/productie?year=${year + 1}&type=${leadType}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            {year + 1}
          </Link>
        </div>

        <form key={year} action={boundSaveDates} className="flex flex-col gap-3">
          <FormToast message="Datums opgeslagen" />
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Productiemaand</th>
                  <th className="px-3 py-3 font-medium">Begindatum</th>
                  <th className="px-3 py-3 font-medium">Einddatum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {months.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                      Productiemaand {String(m.month).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        name={`start_${m.month}`}
                        defaultValue={m.startDate}
                        required
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        name={`end_${m.month}`}
                        defaultValue={m.endDate}
                        required
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Datums opslaan voor {year}
            </button>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-medium text-slate-900 dark:text-slate-100">
          <Table2 size={18} />
          Behaald-cijfers per medewerker, heel {year} in één tabel
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Zelfde correctiemechanisme als op{" "}
          <Link href="/productie" className="underline hover:text-slate-700 dark:hover:text-slate-300">
            Productie
          </Link>
          {" "}(overschrijft het automatisch berekende cijfer, enkel bedoeld om
          data van vóór dit CRM alsnog in te voeren of een fout op te
          lossen), maar hier alle 12 productiemaanden naast elkaar i.p.v.
          maand per maand te moeten doorbladeren — handig om in bulk te
          corrigeren. Een veld leegmaken herstelt het automatisch berekende
          cijfer.
        </p>

        <div className="flex flex-wrap gap-2 text-sm">
          {TYPE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={typeHref(tab.value)}
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

        <UserMonthlyActualsMatrix key={`${year}-${leadType}`} rows={matrixTableRows} year={year} />
      </section>
    </div>
  );
}
