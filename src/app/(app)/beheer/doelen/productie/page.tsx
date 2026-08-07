import Link from "next/link";
import { Target, CalendarRange } from "lucide-react";
import {
  getProductionMonthsForYear,
  saveProductionMonthDatesAction,
} from "@/lib/actions/production";

export default async function ProductieDoelenPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();

  const months = await getProductionMonthsForYear(year);
  const boundSaveDates = saveProductionMonthDatesAction.bind(null, year);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Target size={24} />
          Productiemaanden
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Stel voor elk van de 12 productiemaanden de begin- en einddatum in
          (hoeft niet gelijk te lopen met de kalendermaand). De doelen per
          medewerker per productiemaand stel je in bij{" "}
          <Link href="/beheer/doelen" className="underline hover:text-slate-700">
            Doelen
          </Link>
          .
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-medium text-slate-900">
          <CalendarRange size={18} />
          Datums per productiemaand
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href={`/beheer/doelen/productie?year=${year - 1}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            {year - 1}
          </Link>
          <span className="font-medium text-slate-900">{year}</span>
          <Link
            href={`/beheer/doelen/productie?year=${year + 1}`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            {year + 1}
          </Link>
        </div>

        <form action={boundSaveDates} className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Productiemaand</th>
                  <th className="px-3 py-3 font-medium">Begindatum</th>
                  <th className="px-3 py-3 font-medium">Einddatum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-900">
                      Productiemaand {String(m.month).padStart(2, "0")}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        name={`start_${m.month}`}
                        defaultValue={m.startDate}
                        required
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        name={`end_${m.month}`}
                        defaultValue={m.endDate}
                        required
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
              className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Datums opslaan voor {year}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
