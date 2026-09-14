"use client";

import { useActionState, useState } from "react";
import {
  updateLeadsFromExcelAction,
  type LeadsExcelUpdateState,
} from "@/lib/actions/leadExcelUpdate";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

export function LeadsExcelUpdateForm() {
  const [state, dispatch, pending] = useActionState<LeadsExcelUpdateState, FormData>(
    updateLeadsFromExcelAction,
    null
  );
  // Het bestand zelf bewaren i.p.v. te vertrouwen op de file-input: na een
  // geslaagde form-actie herzet React een ongecontroleerd bestandsveld, dus
  // bij de tweede klik ("Bevestigen") stond er anders geen bestand meer in
  // — waardoor die stap altijd stil faalde (leeg bestand) i.p.v. effectief
  // de aanpassingen door te voeren.
  const [file, setFile] = useState<File | null>(null);

  const hasPreview = state?.mode === "preview";
  const changesCount = state?.matched?.length ?? 0;

  function submit(intent: "preview" | "commit") {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("intent", intent);
    dispatch(fd);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">
          Excel-bestand (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-fit rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => submit("preview")}
          disabled={pending || !file}
          className="self-start rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Bezig…" : "Voorbeeld bekijken"}
        </button>
        {hasPreview && changesCount > 0 && (
          <button
            type="button"
            onClick={() => submit("commit")}
            disabled={pending || !file}
            className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {pending
              ? "Bezig…"
              : `Bevestigen — ${changesCount} lead${changesCount === 1 ? "" : "s"} bijwerken`}
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Bekijk eerst het voorbeeld — er wordt pas iets aangepast in de
        database nadat je op &quot;Bevestigen&quot; klikt.
      </p>

      {state?.mode === "committed" && (
        <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>
            <strong>{state.appliedCount}</strong>{" "}
            {state.appliedCount === 1 ? "lead" : "leads"} bijgewerkt.
          </span>
          {state.failed && state.failed.length > 0 && (
            <div className="text-red-700">
              <p className="font-medium">
                {state.failed.length} mislukt:
              </p>
              <ul className="mt-1 list-inside list-disc">
                {state.failed.map((f, i) => (
                  <li key={i}>
                    Rij {f.row} ({f.sheet}) — {f.name}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {state?.diagnostics && state.diagnostics.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <p className="font-medium">Herkende datumkolom per tabblad:</p>
          <ul className="mt-1 list-inside list-disc">
            {state.diagnostics.map((d, i) => (
              <li key={i}>
                &quot;{d.sheet}&quot;: kolom {d.dateColumnIndex} (koptekst:
                &quot;{d.dateColumnHeader}&quot;), koppenrij {d.headerRowNumber}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasPreview && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            <strong>{changesCount}</strong> lead
            {changesCount === 1 ? "" : "s"} gevonden met een aanpassing.
            {state.unmatched && state.unmatched.length > 0 && (
              <>
                {" "}
                <strong>{state.unmatched.length}</strong> rij
                {state.unmatched.length === 1 ? "" : "en"} niet gevonden of
                niets te doen.
              </>
            )}
          </p>

          {changesCount === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-slate-400">
              Geen enkele rij leidt tot een aanpassing.
            </div>
          )}

          {changesCount > 0 && (
            <div className="max-h-[500px] overflow-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Rij</th>
                    <th className="px-3 py-2 font-medium">Lead</th>
                    <th className="px-3 py-2 font-medium">Gematcht op</th>
                    <th className="px-3 py-2 font-medium">Datum</th>
                    <th className="px-3 py-2 font-medium">Ruwe celwaarde</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Rapportering</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.matched!.map((m, i) => (
                    <tr key={i} className={m.markLost ? "bg-red-50" : undefined}>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                        {m.sheet} · {m.row}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {m.matchedLeadName}
                        {m.name !== m.matchedLeadName && (
                          <span className="ml-1 font-normal text-slate-400">
                            ({m.name} in bestand)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500">{m.matchedOn}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                        {m.dateTo ? (
                          <>
                            {formatDate(m.dateFrom)} →{" "}
                            <strong>{formatDate(m.dateTo)}</strong>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
                        {m.rawDateCell || "(leeg)"}
                      </td>
                      <td className="px-3 py-2">
                        {m.markLost ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            {m.currentlyWon ? "Klant → Geen klant" : "Geen klant"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-xs truncate px-3 py-2 text-slate-600">
                        {m.notePreview ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {state?.unmatched && state.unmatched.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <summary className="cursor-pointer font-medium">
            {state.unmatched.length} rij
            {state.unmatched.length === 1 ? "" : "en"} overgeslagen
          </summary>
          <ul className="mt-2 list-inside list-disc">
            {state.unmatched.map((u, i) => (
              <li key={i}>
                Rij {u.row} ({u.sheet}) — {u.name || "geen naam"}: {u.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
