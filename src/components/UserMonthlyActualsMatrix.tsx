"use client";

import { InlineTextField } from "@/components/InlineTextField";
import { Avatar } from "@/components/Avatar";
import type { UserMonthlyActualsMatrixRow } from "@/lib/actions/production";

export type UserMonthlyActualsMatrixTableRow = UserMonthlyActualsMatrixRow & {
  /** Index 0 = productiemaand 1 t.e.m. index 11 = productiemaand 12, elk al gebonden aan setUserMonthlyActualAction voor deze gebruiker/maand. */
  actionsByMonth: ((formData: FormData) => void | Promise<void>)[];
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

/**
 * Jaaroverzicht van het "behaald"-cijfer per gebruiker per productiemaand
 * (zie setUserMonthlyActualAction) — alles op één pagina i.p.v. maand per
 * maand op de Productie-pagina te moeten doorbladeren, handig om in bulk
 * foutieve historische cijfers (bv. van vóór dit CRM) te corrigeren. Een
 * veld leegmaken herstelt het automatisch berekende cijfer.
 */
export function UserMonthlyActualsMatrix({
  rows,
}: {
  rows: UserMonthlyActualsMatrixTableRow[];
}) {
  const totalsByMonth = Array.from({ length: 12 }, (_, i) =>
    rows.reduce((sum, r) => sum + (r.valuesByMonth[i] ?? 0), 0)
  );
  const grandTotal = totalsByMonth.reduce((sum, v) => sum + v, 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          <tr>
            <th className="sticky left-0 z-10 bg-slate-50 px-3 py-3 font-medium dark:bg-slate-800/60">
              Naam
            </th>
            {MONTH_LABELS.map((label) => (
              <th key={label} className="px-1.5 py-3 text-center font-medium">
                {label}
              </th>
            ))}
            <th className="px-3 py-3 text-center font-medium">Totaal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row) => {
            const rowTotal = row.valuesByMonth.reduce(
              (sum: number, v) => sum + (v ?? 0),
              0
            );
            return (
              <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-2 font-medium text-slate-900 dark:bg-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <Avatar name={row.name} photoUrl={row.photoUrl} />
                    {row.name}
                  </div>
                </td>
                {row.valuesByMonth.map((value, i) => (
                  <td key={i} className="px-1 py-1.5 text-center">
                    <InlineTextField
                      type="number"
                      min={0}
                      step={1}
                      name="actual"
                      value={value !== null ? String(value) : ""}
                      action={row.actionsByMonth[i]}
                      className="w-14 rounded-md border border-slate-300 px-1 py-1 text-center text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </td>
                ))}
                <td className="px-3 py-2 text-center font-medium text-slate-700 dark:text-slate-300">
                  {rowTotal}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={14} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500">
                Nog geen data dit jaar.
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
              <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2.5">Totaal</td>
              {totalsByMonth.map((total, i) => (
                <td key={i} className="px-1.5 py-2.5 text-center">
                  {total}
                </td>
              ))}
              <td className="px-3 py-2.5 text-center">{grandTotal}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
