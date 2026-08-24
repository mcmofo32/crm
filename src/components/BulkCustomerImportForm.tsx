"use client";

import { useActionState } from "react";
import {
  importCustomersBulkAction,
  type CustomerImportState,
} from "@/lib/actions/customerImport";

export function BulkCustomerImportForm({
  ownerCandidates,
  defaultOwnerId,
  subagents,
  defaultCaseManagerSubagentId,
}: {
  ownerCandidates: { id: string; name: string }[];
  defaultOwnerId: string;
  subagents: { id: string; name: string }[];
  /** Vooringevuld op de subagent zelf als de importeur er één is — leeg ("") laat de placeholder staan zodat een niet-subagent bewust moet kiezen. */
  defaultCaseManagerSubagentId: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerImportState, FormData>(
    importCustomersBulkAction,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Funnel</label>
        <select
          name="leadType"
          defaultValue="FA"
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="FA">Financiële analyse (Klant)</option>
          <option value="RG">Recrutering (Medewerker)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">
          Aanbrenger{" "}
          <span className="font-normal text-slate-400">
            (terugvalwaarde — heeft je bestand per medewerker een apart
            tabblad, dan wordt de aanbrenger automatisch uit de tabbladnaam
            afgeleid en telt dit enkel nog mee als er geen match is)
          </span>
        </label>
        <select
          name="ownerId"
          required
          defaultValue={defaultOwnerId}
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {ownerCandidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {subagents.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Dossierbeheerder
          </label>
          <select
            name="caseManagerSubagentId"
            required
            defaultValue={defaultCaseManagerSubagentId}
            className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Kies een dossierbeheerder…
            </option>
            {subagents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Wie deze dossiers beheert (producten toevoegt, opvolgt) — geldt
            voor alle klanten in deze import, ongeacht wie hierboven als
            medewerker/eigenaar geldt.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">
          Excel-bestand (.xlsx)
        </label>
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      {state?.createdCount !== undefined && (
        <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>
            <strong>{state.createdCount}</strong>{" "}
            {state.createdCount === 1 ? "klant" : "klanten"} aangemaakt.
          </span>
          {state.skippedSheets && state.skippedSheets.length > 0 && (
            <div className="text-amber-800">
              <p className="font-medium">
                {state.skippedSheets.length}{" "}
                {state.skippedSheets.length === 1 ? "tabblad" : "tabbladen"}{" "}
                overgeslagen:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {state.skippedSheets.map((s, i) => (
                  <li key={i}>
                    &ldquo;{s.sheet}&rdquo;: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {state.skipped && state.skipped.length > 0 && (
            <div className="text-amber-800">
              <p className="font-medium">
                {state.skipped.length}{" "}
                {state.skipped.length === 1 ? "rij" : "rijen"} overgeslagen:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {state.skipped.map((s, i) => (
                  <li key={i}>
                    Rij {s.row} ({s.name || "geen naam"}): {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Bezig met importeren…" : "Klanten importeren"}
      </button>
    </form>
  );
}
