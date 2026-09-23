"use client";

import { useActionState } from "react";
import { createLeadAction, type CreateLeadState } from "@/lib/actions/leads";
import { SubmitButton } from "@/components/SubmitButton";
import type { LeadType } from "@/generated/prisma/client";

export function CreateLeadForm({
  leadType,
  viewerId,
  assignableUsers,
}: {
  leadType: LeadType;
  viewerId: string;
  assignableUsers: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<CreateLeadState, FormData>(
    createLeadAction,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
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
            defaultValue={viewerId}
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

      {state?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {state.error}
        </div>
      )}

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
