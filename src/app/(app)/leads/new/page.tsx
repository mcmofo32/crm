import Link from "next/link";
import { getEffectiveViewer } from "@/lib/impersonation";
import { createLeadAction } from "@/lib/actions/leads";
import { getAssignableUsers } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";
import { ToastOnParam } from "@/components/toast/ToastOnParam";
import { LeadType } from "@/generated/prisma/client";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    created?: string;
    duplicateName?: string;
    duplicateOwner?: string;
  }>;
}) {
  const { type, duplicateName, duplicateOwner } = await searchParams;
  // Vanuit Funnel/Pipeline/Leads FA of RG komt de funnel automatisch mee in
  // de link; zonder die context (bv. rechtstreeks naar /leads/new) valt dit
  // terug op FA — er is dus geen keuzeveld meer nodig.
  const leadType: LeadType = type === "RG" ? "RG" : "FA";
  const viewer = (await getEffectiveViewer())!;
  const assignableUsers = await getAssignableUsers();

  return (
    <div className="max-w-xl">
      <ToastOnParam param="created" message="Lead aangemaakt" />
      {duplicateName && duplicateOwner && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          Let op: <strong>{duplicateName}</strong> staat al als lead
          geregistreerd bij <strong>{duplicateOwner}</strong> (zelfde
          e-mailadres of telefoonnummer). Deze nieuwe lead is wel aangemaakt —
          neem contact op met een beheerder om dit na te kijken.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Nieuwe lead
        </h1>
        <Link
          href="/leads/bulk"
          className="text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          Meerdere leads in bulk toevoegen
        </Link>
      </div>
      <form action={createLeadAction} className="flex flex-col gap-4">
        <input type="hidden" name="leadType" value={leadType} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Voornaam" name="firstName" required />
          <Field label="Achternaam" name="lastName" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-mail" name="email" type="email" />
          <Field label="Telefoon" name="phone" type="tel" />
        </div>
        {assignableUsers.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Eigenaar
            </label>
            <select
              name="ownerId"
              defaultValue={viewer.id}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Field label="Bron" name="source" placeholder="bv. website, doorverwijzing" />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Notities
          </label>
          <textarea
            name="notes"
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <SubmitButton className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300">
            Lead aanmaken
          </SubmitButton>
          <SubmitButton
            name="intent"
            value="createAnother"
            className="self-start rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Opslaan en nog een lead aanmaken
          </SubmitButton>
        </div>
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
