"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Pencil } from "lucide-react";
import { updateLeadDetailsAction } from "@/lib/actions/leads";
import { FormToast } from "@/components/toast/FormToast";

export function LeadDetailsCard({
  leadId,
  firstName,
  lastName,
  email,
  phone,
  source,
  notes,
}: {
  leadId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-3 font-medium text-slate-900">Contactgegevens bewerken</h2>
        <form
          action={(formData) =>
            startTransition(async () => {
              await updateLeadDetailsAction(leadId, formData);
              setEditing(false);
            })
          }
          className="flex flex-col gap-3"
        >
          <FormToast message="Contactgegevens opgeslagen" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Voornaam" name="firstName" defaultValue={firstName} required />
            <Field label="Achternaam" name="lastName" defaultValue={lastName} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail" name="email" type="email" defaultValue={email ?? ""} />
            <Field label="Telefoon" name="phone" type="tel" defaultValue={phone ?? ""} />
          </div>
          <Field label="Bron" name="source" defaultValue={source ?? ""} />
          <div className="flex flex-col gap-1">
            <label className="text-slate-600">Notities</label>
            <textarea
              name="notes"
              rows={3}
              defaultValue={notes ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Opslaan
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuleren
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium text-slate-900">Contactgegevens</h2>
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Bewerken"
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          <Pencil size={13} />
          Bewerken
        </button>
      </div>
      <dl className="flex flex-col gap-3">
        <Row label="Voornaam" value={firstName} />
        <Row label="Achternaam" value={lastName} />
        <Row icon={Mail} label="E-mail" value={email} />
        <Row icon={Phone} label="Telefoon" value={phone} />
        <Row label="Bron" value={source} />
      </dl>
      <div className="mt-3 border-t border-slate-100 pt-3">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Notities
        </p>
        <p className="whitespace-pre-wrap text-slate-600">
          {notes || <span className="text-slate-300">Nog geen notities toegevoegd.</span>}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-slate-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="rounded-md border border-slate-300 px-3 py-2"
      />
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: typeof Mail;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-slate-400">
        {Icon && <Icon size={14} />}
        {label}
      </dt>
      <dd className="text-right text-slate-700">
        {value || <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}
