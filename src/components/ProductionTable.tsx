"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { InlineTextField } from "@/components/InlineTextField";
import { Position, PercentBadge } from "@/components/ProductionShared";
import { CijfersPosterHeader } from "@/components/CijfersPosterHeader";
import type { ProductionRow } from "@/lib/actions/production";

export type ProductionTableRow = ProductionRow & {
  setCustomersGoal: (formData: FormData) => void | Promise<void>;
  setUnitsGoal: (formData: FormData) => void | Promise<void>;
  setCustomersActual: (formData: FormData) => void | Promise<void>;
  setUnitsActual: (formData: FormData) => void | Promise<void>;
};

export function ProductionTable({
  rows,
  canEditGoals,
  periodLabel,
}: {
  rows: ProductionTableRow[];
  canEditGoals: boolean;
  periodLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const showInputs = canEditGoals && editing;

  const totalTargetCustomers = rows.reduce((s, r) => s + r.targetCustomers, 0);
  const totalActualCustomers = rows.reduce((s, r) => s + r.actualCustomers, 0);
  const totalPercentCustomers =
    totalTargetCustomers > 0
      ? Math.round((totalActualCustomers / totalTargetCustomers) * 100)
      : null;
  const totalTargetUnits = rows.reduce((s, r) => s + r.targetUnits, 0);
  const totalActualUnits = rows.reduce((s, r) => s + r.actualUnits, 0);
  const totalPercentUnits =
    totalTargetUnits > 0 ? Math.round((totalActualUnits / totalTargetUnits) * 100) : null;

  return (
    <div className="flex flex-col gap-3">
      {canEditGoals && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`inline-flex w-fit items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium ${
              editing
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Pencil size={14} />
            {editing ? "Klaar met wijzigen" : "Doelen/behaald wijzigen"}
          </button>
          {editing && (
            <p className="text-xs text-slate-400">
              Behaald KL/EH aanpassen overschrijft de automatische berekening
              — handig om data van vóór dit CRM in te voeren. Veld leegmaken
              herstelt de automatische berekening.
            </p>
          )}
        </div>
      )}

      <div
        id="cijfers-export-tabel"
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <CijfersPosterHeader title="Cijfers — Productie" subtitle={periodLabel} />
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-3 py-3 font-medium">#</th>
              <th className="px-3 py-3 font-medium">Naam</th>
              <th className="px-3 py-3 font-medium">Functie</th>
              <th className="px-3 py-3 font-medium">Directe coach</th>
              <th className="px-3 py-3 text-center font-medium">Doel KL</th>
              <th className="px-3 py-3 text-center font-medium">Behaald KL</th>
              <th className="px-3 py-3 text-center font-medium">% Doel KL</th>
              <th className="px-3 py-3 text-center font-medium">Doel EH</th>
              <th className="px-3 py-3 text-center font-medium">Behaald EH</th>
              <th className="px-3 py-3 text-center font-medium">% Doel EH</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <Position position={i + 1} />
                </td>
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {row.name}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {row.jobFunction ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-600">
                  {row.coachName ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">
                  {showInputs ? (
                    <InlineTextField
                      type="number"
                      min={0}
                      step={1}
                      name="target"
                      value={row.targetCustomers ? String(row.targetCustomers) : ""}
                      action={row.setCustomersGoal}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm disabled:opacity-60"
                    />
                  ) : (
                    row.targetCustomers || "—"
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-900">
                  {showInputs ? (
                    <InlineTextField
                      type="number"
                      min={0}
                      step={1}
                      name="actual"
                      value={row.actualCustomers ? String(row.actualCustomers) : ""}
                      action={row.setCustomersActual}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm disabled:opacity-60"
                    />
                  ) : (
                    row.actualCustomers
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <PercentBadge percent={row.percentCustomers} />
                </td>
                <td className="px-3 py-2.5 text-center text-slate-600">
                  {showInputs ? (
                    <InlineTextField
                      type="number"
                      min={0}
                      step={1}
                      name="target"
                      value={row.targetUnits ? String(row.targetUnits) : ""}
                      action={row.setUnitsGoal}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm disabled:opacity-60"
                    />
                  ) : (
                    row.targetUnits || "—"
                  )}
                </td>
                <td className="px-3 py-2.5 text-center text-slate-900">
                  {showInputs ? (
                    <InlineTextField
                      type="number"
                      min={0}
                      step={1}
                      name="actual"
                      value={row.actualUnits ? String(row.actualUnits) : ""}
                      action={row.setUnitsActual}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-center text-sm disabled:opacity-60"
                    />
                  ) : (
                    row.actualUnits
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <PercentBadge percent={row.percentUnits} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                  Geen gebruikers gevonden.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
                <td className="px-3 py-2.5" colSpan={4}>
                  Totaal
                </td>
                <td className="px-3 py-2.5 text-center">{totalTargetCustomers}</td>
                <td className="px-3 py-2.5 text-center">{totalActualCustomers}</td>
                <td className="px-3 py-2.5 text-center">
                  <PercentBadge percent={totalPercentCustomers} />
                </td>
                <td className="px-3 py-2.5 text-center">{totalTargetUnits}</td>
                <td className="px-3 py-2.5 text-center">{totalActualUnits}</td>
                <td className="px-3 py-2.5 text-center">
                  <PercentBadge percent={totalPercentUnits} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
        </div>
      </div>
    </div>
  );
}
