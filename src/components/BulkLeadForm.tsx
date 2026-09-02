"use client";

import { useState, type ClipboardEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createLeadsBulkAction } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import type { LeadType } from "@/generated/prisma/client";

type TextField = "firstName" | "lastName" | "email" | "phone" | "source" | "type";
type Row = Record<TextField, string> & { key: string };

const COLUMNS: TextField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "source",
  "type",
];
const COLUMN_LABELS: Record<TextField, string> = {
  firstName: "Voornaam",
  lastName: "Achternaam",
  email: "E-mail",
  phone: "Telefoon",
  source: "Bron",
  type: "Type (FA/RG)",
};
const REQUIRED_COLUMNS = new Set<TextField>(["firstName"]);
/** Achternaam is niet verplicht: mag later nog aangevuld worden op de lead zelf. */
const OPTIONAL_COLUMNS = new Set<TextField>(["lastName"]);
/** Optioneel: leeg = de standaard Funnel bovenaan het formulier. */
const OPTIONAL_OVERRIDE_COLUMNS = new Set<TextField>(["type"]);

let rowCounter = 0;
function emptyRow(): Row {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "",
    type: "",
  };
}

export function BulkLeadForm() {
  const [leadType, setLeadType] = useState<LeadType>("FA" as LeadType);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: 8 }, () => emptyRow())
  );

  function updateCell(rowIndex: number, field: TextField, value: string) {
    setRows((current) => {
      const next = [...current];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(key: string) {
    setRows((current) =>
      current.length > 1 ? current.filter((r) => r.key !== key) : current
    );
  }

  function handlePaste(
    rowIndex: number,
    colIndex: number,
    e: ClipboardEvent<HTMLInputElement>
  ) {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();

    const lines = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((line, i, arr) => !(i === arr.length - 1 && line === ""));
    const grid = lines.map((line) => line.split("\t"));

    setRows((current) => {
      const next = [...current];
      grid.forEach((line, lineIndex) => {
        const targetIndex = rowIndex + lineIndex;
        while (next.length <= targetIndex) next.push(emptyRow());
        line.forEach((value, cellOffset) => {
          const targetCol = COLUMNS[colIndex + cellOffset];
          if (targetCol) {
            next[targetIndex] = { ...next[targetIndex], [targetCol]: value.trim() };
          }
        });
      });
      return next;
    });
  }

  const filledCount = rows.filter(
    (r) => r.firstName.trim() || r.lastName.trim()
  ).length;

  return (
    <form action={createLeadsBulkAction} className="flex flex-col gap-4">
      <input type="hidden" name="leadType" value={leadType} />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Funnel (standaard)
          </label>
          <select
            value={leadType}
            onChange={(e) => setLeadType(e.target.value as LeadType)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="FA">{LEAD_TYPE_LABELS.FA}</option>
            <option value="RG">{LEAD_TYPE_LABELS.RG}</option>
          </select>
        </div>
        <p className="max-w-md text-sm text-slate-500">
          Tip: plak gerust een selectie uit Excel/Sheets direct in de tabel.
          Elke rij wordt automatisch aan jezelf toegewezen. De kolommen
          Achternaam en Type zijn optioneel per rij — Achternaam kan later nog
          aangevuld worden, en een lege Type-kolom gebruikt de standaardwaarde
          hierboven.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-700">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col} className="px-3 py-2 font-semibold">
                  {COLUMN_LABELS[col]}
                  {REQUIRED_COLUMNS.has(col) && (
                    <span className="text-red-500"> *</span>
                  )}
                  {(OPTIONAL_COLUMNS.has(col) || OPTIONAL_OVERRIDE_COLUMNS.has(col)) && (
                    <span className="font-normal text-slate-500"> (optioneel)</span>
                  )}
                </th>
              ))}
              <th className="w-10 px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={row.key}>
                {COLUMNS.map((col, colIndex) => (
                  <td key={col} className="p-1">
                    <input
                      name={col}
                      value={row[col]}
                      onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                      onPaste={(e) => handlePaste(rowIndex, colIndex, e)}
                      className="w-full rounded border border-transparent px-2.5 py-2 text-slate-900 hover:border-slate-200 focus:border-slate-400 focus:outline-none"
                    />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={rows.length === 1}
                    title="Rij verwijderen"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Plus size={15} />
          Rij toevoegen
        </button>
        <SubmitButton
          disabled={filledCount === 0}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {filledCount > 0 ? `${filledCount} leads aanmaken` : "Leads aanmaken"}
        </SubmitButton>
      </div>
    </form>
  );
}
