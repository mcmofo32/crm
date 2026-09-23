"use client";

import { useActionState } from "react";
import { createCustomerAction, type CreateCustomerState } from "@/lib/actions/leads";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";

export function CreateCustomerForm({
  viewerId,
  ownerCandidates,
  subagents,
  defaultCaseManagerSubagentId,
}: {
  viewerId: string;
  ownerCandidates: { id: string; name: string }[];
  subagents: { id: string; name: string }[];
  defaultCaseManagerSubagentId: string;
}) {
  const [state, formAction, pending] = useActionState<CreateCustomerState, FormData>(
    createCustomerAction,
    null
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Funnel</label>
        <select
          name="leadType"
          defaultValue="FA"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="FA">Financiële analyse (Klant)</option>
          <option value="RG">Recrutering (Medewerker)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Voornaam" name="firstName" required />
        <Field label="Achternaam" name="lastName" required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="E-mail" name="email" type="email" />
        <Field label="Telefoon" name="phone" type="tel" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Aanbrenger
        </label>
        <select
          name="ownerId"
          required
          defaultValue={viewerId}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {ownerCandidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Wie deze klant aangebracht heeft — bepaalt bij wie de klant in de
          cijfers/eenheden op het leaderboard meetelt.
        </p>
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
            Wie dit dossier beheert (producten toevoegt, opvolgt) — kan
            enkel een subagent zijn, niet noodzakelijk dezelfde persoon als
            de aanbrenger hierboven.
          </p>
        </div>
      )}

      <Field label="Bron" name="source" placeholder="bv. oud systeem, doorverwijzing" />

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Notities <span className="font-normal text-slate-400 dark:text-slate-500">(optioneel)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="bv. belegt zelf ook, en in wat..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="becameCustomerAt" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Klant sinds
        </label>
        <input
          id="becameCustomerAt"
          name="becameCustomerAt"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          max={new Date().toISOString().slice(0, 10)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Bepaalt in welke productiemaand deze klant meetelt — bij een
          bestaande klant uit een oud systeem is dit dus niet vandaag, maar
          wanneer die persoon toen effectief klant werd.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Producten <span className="font-normal text-slate-400 dark:text-slate-500">(minstens 1 verplicht)</span>
        </p>
        <div className="grid grid-cols-[1fr_6.5rem_6.5rem_5.5rem] items-center gap-x-2 gap-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Product
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Bedrag/maand (€)
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Koopsom (€)
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Eenheden
          </span>
          {PRODUCT_TYPE_ORDER.map((type) => (
            <div key={type} className="contents">
              <span className="text-slate-600 dark:text-slate-400">{PRODUCT_TYPE_LABELS[type]}</span>
              <input
                type="number"
                min={0}
                step="0.01"
                name={`amount-${type}`}
                className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Eenmalig"
                title="Eenmalige koopsom (bv. €10.000 in één keer) — telt niet mee in het maandelijkse incasso"
                name={`lumpsum-${type}`}
                className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="1"
                name={`units-${type}`}
                className="rounded-md border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Koopsom = een eenmalige aankoop (bv. in één keer beleggen) i.p.v.
          een maandelijks bedrag — telt niet mee in het maandelijkse
          incasso.
        </p>
      </div>

      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        {pending ? "Bezig..." : "Klant aanmaken"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
    </div>
  );
}
