import { createLeadAction } from "@/lib/actions/leads";
import { getAssignableUsers } from "@/lib/actions/leads";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";

export default async function NewLeadPage() {
  const assignableUsers = await getAssignableUsers();

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">
        Nieuwe lead
      </h1>
      <form action={createLeadAction} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Voornaam" name="firstName" required />
          <Field label="Achternaam" name="lastName" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="E-mail" name="email" type="email" />
          <Field label="Telefoon" name="phone" type="tel" />
        </div>
        <Field label="Bedrijf" name="company" />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Funnel
          </label>
          <select
            name="leadType"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="FA">{LEAD_TYPE_LABELS.FA}</option>
            <option value="RG">{LEAD_TYPE_LABELS.RG}</option>
          </select>
        </div>

        {assignableUsers.length > 1 && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">
              Eigenaar
            </label>
            <select
              name="ownerId"
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
