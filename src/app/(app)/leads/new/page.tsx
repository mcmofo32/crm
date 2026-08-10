import Link from "next/link";
import { getEffectiveViewer } from "@/lib/impersonation";
import { createLeadAction } from "@/lib/actions/leads";
import { getAssignableUsers } from "@/lib/actions/leads";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";

export default async function NewLeadPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  // Vanuit Funnel/Pipeline/Leads FA of RG komt de funnel automatisch mee in
  // de link; zonder die context (bv. rechtstreeks naar /leads/new) valt dit
  // terug op FA — er is dus geen keuzeveld meer nodig.
  const leadType: LeadType = type === "RG" ? "RG" : "FA";
  const viewer = (await getEffectiveViewer())!;
  const assignableUsers = await getAssignableUsers();

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">
          Nieuwe lead
        </h1>
        <Link
          href="/leads/bulk"
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          Meerdere leads in bulk toevoegen
        </Link>
      </div>
      <form action={createLeadAction} className="flex flex-col gap-4">
        <input type="hidden" name="leadType" value={leadType} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Voornaam" name="firstName" required />
          <Field label="Achternaam" name="lastName" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="E-mail" name="email" type="email" />
          <Field label="Telefoon" name="phone" type="tel" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Funnel
          </label>
          <Badge variant={LEAD_TYPE_BADGE_VARIANT[leadType]} className="w-fit">
            {LEAD_TYPE_LABELS[leadType]}
          </Badge>
        </div>

        {assignableUsers.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Eigenaar
            </label>
            <select
              name="ownerId"
              defaultValue={viewer.id}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <label className="text-sm font-medium text-slate-700">
            Notities
          </label>
          <textarea
            name="notes"
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Lead aanmaken
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
