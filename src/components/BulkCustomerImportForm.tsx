"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  importCustomersBulkAction,
  type CustomerImportState,
} from "@/lib/actions/customerImport";
import { useToast } from "@/components/toast/ToastProvider";

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
  const wasPending = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (wasPending.current && !pending && state?.createdCount !== undefined) {
      showToast(`${state.createdCount} klanten geïmporteerd`);
    }
    wasPending.current = pending;
  }, [pending, state, showToast]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Funnel</label>
        <select
          name="leadType"
          defaultValue="FA"
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="FA">Financiële analyse (Klant)</option>
          <option value="RG">Recrutering (Medewerker)</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Aanbrenger{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            (terugvalwaarde — heeft je bestand per medewerker een apart
            tabblad, dan wordt de aanbrenger automatisch uit de tabbladnaam
            afgeleid en telt dit enkel nog mee als er geen match is)
          </span>
        </label>
        <select
          name="ownerId"
          required
          defaultValue={defaultOwnerId}
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Dossierbeheerder
          </label>
          <select
            name="caseManagerSubagentId"
            required
            defaultValue={defaultCaseManagerSubagentId}
            className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Wie deze dossiers beheert (producten toevoegt, opvolgt) — geldt
            voor alle klanten in deze import, ongeacht wie hierboven als
            medewerker/eigenaar geldt.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Excel-bestand (.xlsx)
        </label>
        <input
          type="file"
          name="file"
          accept=".xlsx,.xls"
          required
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </div>
      )}

      {state?.createdCount !== undefined && (
        <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
          <span>
            <strong>{state.createdCount}</strong>{" "}
            {state.createdCount === 1 ? "klant" : "klanten"} aangemaakt.
          </span>
          {state.skippedSheets && state.skippedSheets.length > 0 && (
            <div className="text-amber-800 dark:text-amber-400">
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
            <div className="text-amber-800 dark:text-amber-400">
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
        className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        {pending ? "Bezig met importeren…" : "Klanten importeren"}
      </button>
    </form>
  );
}
