"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { createIncentiveAction } from "@/lib/actions/incentives";

const METRIC_OPTIONS = [
  { value: "CLIENTS_WON", label: "Aantal klanten" },
  { value: "UNITS", label: "Aantal eenheden" },
  { value: "RG_MEETINGS", label: "Aantal RG-gesprekken" },
  { value: "ACTIVITIES_COMPLETED", label: "Afgeronde contactmomenten" },
];

type CategoryRow = { key: string };

let rowCounter = 0;
function newRowKey() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

export function IncentiveForm() {
  const [mode, setMode] = useState<"THRESHOLD" | "TOP_N">("THRESHOLD");
  const [rows, setRows] = useState<CategoryRow[]>([{ key: newRowKey() }]);

  function addRow() {
    setRows((current) => [...current, { key: newRowKey() }]);
  }

  function removeRow(key: string) {
    setRows((current) => (current.length > 1 ? current.filter((r) => r.key !== key) : current));
  }

  return (
    <form
      action={createIncentiveAction}
      encType="multipart/form-data"
      className="flex flex-col gap-4 text-sm"
    >
      <div className="flex flex-col gap-1">
        <label className="font-medium text-slate-700">Titel</label>
        <input
          name="title"
          required
          placeholder="bv. Zomerpush FA"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-medium text-slate-700">
          Vereisten om te winnen
        </label>
        <textarea
          name="description"
          required
          rows={4}
          placeholder="bv. Wie de richtcijfers haalt wint een cadeaubon."
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-medium text-slate-700">Ranglijst-modus</label>
        <div className="flex flex-col gap-2 rounded-md border border-slate-300 p-3 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="THRESHOLD"
              checked={mode === "THRESHOLD"}
              onChange={() => setMode("THRESHOLD")}
            />
            Richtcijfers per categorie
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="mode"
              value="TOP_N"
              checked={mode === "TOP_N"}
              onChange={() => setMode("TOP_N")}
            />
            Top-N wint (geen richtcijfer)
          </label>
        </div>
      </div>

      {mode === "THRESHOLD" ? (
        <div className="flex flex-col gap-2">
          <label className="font-medium text-slate-700">
            Ranglijst gebaseerd op (met richtcijfer per categorie)
          </label>
          {rows.map((row) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2">
              <select
                name="categoryMetric"
                defaultValue="CLIENTS_WON"
                className="flex-1 rounded-md border border-slate-300 px-3 py-2"
              >
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                name="categoryLeadType"
                defaultValue=""
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">FA + RG</option>
                <option value="FA">Enkel FA</option>
                <option value="RG">Enkel RG</option>
              </select>
              <input
                name="categoryTarget"
                type="number"
                min={1}
                required
                placeholder="Richtcijfer"
                className="w-32 rounded-md border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                disabled={rows.length === 1}
                title="Categorie verwijderen"
                className="rounded-md border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="flex w-fit items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          >
            <Plus size={15} />
            Categorie toevoegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">
              Ranglijst gebaseerd op
            </label>
            <select
              name="rankingMetric"
              defaultValue="CLIENTS_WON"
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {METRIC_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">Funnel</label>
            <select
              name="rankingLeadType"
              defaultValue=""
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">FA + RG</option>
              <option value="FA">Enkel FA</option>
              <option value="RG">Enkel RG</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">Wint</label>
            <select
              name="topN"
              defaultValue="5"
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Startdatum</label>
          <input
            name="startDate"
            type="date"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Einddatum</label>
          <input
            name="endDate"
            type="date"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-medium text-slate-700">
          Poster (JPEG of PDF, max 8 MB)
        </label>
        <input
          name="poster"
          type="file"
          accept="image/jpeg,application/pdf"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </div>

      <button
        type="submit"
        className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
      >
        Evenement aanmaken
      </button>
    </form>
  );
}
