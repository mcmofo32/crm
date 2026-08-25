import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageCustomerData } from "@/lib/permissions";
import { createCustomerAction, getOwnerCandidates } from "@/lib/actions/leads";
import { getSubagents } from "@/lib/actions/subagents";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";

export default async function NewCustomerPage() {
  const viewer = (await getEffectiveViewer())!;
  if (!canManageCustomerData(viewer)) notFound();

  const [ownerCandidates, subagents] = await Promise.all([
    getOwnerCandidates(),
    getSubagents(),
  ]);
  // Is de aanmaker zelf een subagent, dan is hij standaard ook de
  // dossierbeheerder van de klant die hij toevoegt.
  const defaultCaseManagerSubagentId =
    subagents.find((s) => s.userId === viewer.id)?.id ?? "";

  return (
    <div className="max-w-xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Klant toevoegen
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Maakt meteen een klant aan (met producten) i.p.v. eerst als lead
            door de funnel te lopen — handig om bestaande klanten uit een
            oud systeem over te zetten.
          </p>
        </div>
        <Link
          href="/klanten/bulk"
          className="whitespace-nowrap text-sm text-slate-500 underline hover:text-slate-700"
        >
          Meerdere in bulk (Excel)
        </Link>
      </div>
      <form action={createCustomerAction} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Funnel</label>
          <select
            name="leadType"
            defaultValue="FA"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <label className="text-sm font-medium text-slate-700">
            Aanbrenger
          </label>
          <select
            name="ownerId"
            required
            defaultValue={viewer.id}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {ownerCandidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400">
            Wie deze klant aangebracht heeft — bepaalt bij wie de klant in de
            cijfers/eenheden op het leaderboard meetelt.
          </p>
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
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
              Wie dit dossier beheert (producten toevoegt, opvolgt) — kan
              enkel een subagent zijn, niet noodzakelijk dezelfde persoon als
              de aanbrenger hierboven.
            </p>
          </div>
        )}

        <Field label="Bron" name="source" placeholder="bv. oud systeem, doorverwijzing" />

        <div className="flex flex-col gap-1">
          <label htmlFor="becameCustomerAt" className="text-sm font-medium text-slate-700">
            Klant sinds
          </label>
          <input
            id="becameCustomerAt"
            name="becameCustomerAt"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            max={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-400">
            Bepaalt in welke productiemaand deze klant meetelt — bij een
            bestaande klant uit een oud systeem is dit dus niet vandaag, maar
            wanneer die persoon toen effectief klant werd.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-slate-700">
            Producten <span className="font-normal text-slate-400">(minstens 1 verplicht)</span>
          </p>
          <div className="grid grid-cols-[1fr_7rem_6rem] items-center gap-x-2 gap-y-1.5 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Product
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Bedrag (€)
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Eenheden
            </span>
            {PRODUCT_TYPE_ORDER.map((type) => (
              <div key={type} className="contents">
                <span className="text-slate-600">{PRODUCT_TYPE_LABELS[type]}</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  name={`amount-${type}`}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                />
                <input
                  type="number"
                  min={0}
                  step="1"
                  name={`units-${type}`}
                  className="rounded-md border border-slate-300 px-2 py-1.5"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Klant aanmaken
        </button>
      </form>
    </div>
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
      <label htmlFor={name} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
