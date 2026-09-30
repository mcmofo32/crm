"use client";

import { useTransition } from "react";
import { Eraser, Lock } from "lucide-react";
import { InlineTextField } from "@/components/InlineTextField";
import { Avatar } from "@/components/Avatar";
import type { UserMonthlyActualsMatrixRow } from "@/lib/actions/production";

export type UserMonthlyActualsMatrixTableRow = UserMonthlyActualsMatrixRow & {
  /** Index 0 = productiemaand 1 t.e.m. index 11 = productiemaand 12, elk al gebonden aan setUserMonthlyActualAction voor deze gebruiker/maand. */
  actionsByMonth: ((formData: FormData) => void | Promise<void>)[];
  /** Gebonden aan resetUserYearActualsAction voor deze gebruiker — zet in één keer alle 12 maanden op een expliciete 0-correctie. */
  resetYear: () => void | Promise<void>;
};

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

/** Bevestigingsknop om alle 12 maanden van één gebruiker in één keer op 0 te zetten — voor wie dit hele jaar geen echte activiteit had. */
function ResetYearButton({
  name,
  year,
  action,
}: {
  name: string;
  year: number;
  action: () => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={`Hele jaar ${year} op 0 zetten voor ${name}`}
      onClick={() => {
        if (
          confirm(
            `Alle 12 maanden van ${year} voor ${name} op 0 zetten? Dit overschrijft het automatisch berekende cijfer voor elke maand (leegmaken van een individuele cel herstelt dat later weer per maand).`
          )
        ) {
          startTransition(() => {
            action();
          });
        }
      }}
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <Eraser size={13} />
    </button>
  );
}

/** Bevestigingsknop om voor iedereen tegelijk het huidige cijfer van één productiemaand te bevriezen als correctie — zodat het later niet meer wijzigt (bv. door een medewerker die stopt). */
function CloseMonthButton({
  label,
  year,
  action,
}: {
  label: string;
  year: number;
  action: () => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title={`Productiemaand ${label} van ${year} afsluiten — bevriest ieders huidige cijfer als correctie`}
      onClick={() => {
        if (
          confirm(
            `Productiemaand ${label} van ${year} afsluiten? Ieders huidige cijfer (automatisch berekend of al gecorrigeerd) wordt vastgezet als correctie voor deze maand, zodat het later niet meer wijzigt — je kan een cel daarna nog altijd individueel corrigeren.`
          )
        ) {
          startTransition(() => {
            action();
          });
        }
      }}
      className="mt-0.5 flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <Lock size={11} />
    </button>
  );
}

/**
 * Jaaroverzicht van het "behaald"-cijfer per gebruiker per productiemaand
 * (zie setUserMonthlyActualAction) — alles op één pagina i.p.v. maand per
 * maand op de Productie-pagina te moeten doorbladeren, handig om in bulk
 * foutieve historische cijfers (bv. van vóór dit CRM) te corrigeren. Een
 * veld leegmaken herstelt het automatisch berekende cijfer.
 */
export function UserMonthlyActualsMatrix({
  rows,
  year,
  closeMonthActions,
}: {
  rows: UserMonthlyActualsMatrixTableRow[];
  year: number;
  /** Index 0 = productiemaand 1 t.e.m. index 11 = productiemaand 12, elk al gebonden aan closeMonthAction — enkel meegegeven voor FA (zie Robins keuze: maandafsluiting enkel voor Productie). */
  closeMonthActions?: (() => void | Promise<void>)[];
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
            {MONTH_LABELS.map((label, i) => (
              <th key={label} className="px-1.5 py-3 text-center font-medium">
                <div className="flex flex-col items-center">
                  {label}
                  {closeMonthActions && (
                    <CloseMonthButton label={label} year={year} action={closeMonthActions[i]} />
                  )}
                </div>
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
                    <ResetYearButton name={row.name} year={year} action={row.resetYear} />
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
