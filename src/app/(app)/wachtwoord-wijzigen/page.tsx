import { KeyRound } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { completeForcedPasswordChangeAction } from "@/lib/actions/profile";

export default async function WachtwoordWijzigenPage() {
  const viewer = (await getEffectiveViewer())!;

  return (
    <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
          <KeyRound size={18} />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            Kies een nieuw wachtwoord
          </h1>
          <p className="text-sm text-slate-500">Hallo {viewer.name}</p>
        </div>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Je bent ingelogd met een tijdelijk wachtwoord. Kies eerst je eigen
        wachtwoord — daarna kan je verder in het CRM.
      </p>
      <form
        action={completeForcedPasswordChangeAction}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Nieuw wachtwoord
          </span>
          <input
            type="password"
            name="newPassword"
            required
            minLength={8}
            autoFocus
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Bevestig nieuw wachtwoord
          </span>
          <input
            type="password"
            name="newPasswordConfirm"
            required
            minLength={8}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-slate-400">Minstens 8 tekens.</p>
        <button
          type="submit"
          className="mt-1 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Wachtwoord instellen
        </button>
      </form>
    </div>
  );
}
