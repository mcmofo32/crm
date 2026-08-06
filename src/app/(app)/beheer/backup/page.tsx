import { redirect } from "next/navigation";
import Link from "next/link";
import { CloudUpload, ExternalLink } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageSettings } from "@/lib/permissions";
import {
  getBackupStatusForAdmin,
  triggerManualBackupSyncAction,
} from "@/lib/actions/sheetsBackup";

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Google Sheets back-up is niet geconfigureerd voor deze omgeving (GOOGLE_CLIENT_ID/SECRET/GOOGLE_SHEETS_REDIRECT_URI ontbreken).",
  invalid_state: "Koppelen is mislukt. Probeer opnieuw.",
  "1": "Koppelen van Google Sheets back-up is mislukt. Probeer opnieuw.",
};

function formatDateTime(date: Date | null) {
  if (!date) return "Nog nooit";
  return date.toLocaleString("nl-BE", { dateStyle: "medium", timeStyle: "short" });
}

export default async function BackupPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canManageSettings(viewer)) redirect("/dashboard");

  const { connected, error } = await searchParams;
  const status = await getBackupStatusForAdmin();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <CloudUpload size={24} />
          Google Sheets back-up
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Alle CRM-data wordt automatisch (nachtelijks) weggeschreven naar één
          Google Sheets-bestand — één tabblad per onderdeel, met een
          verzorgde opmaak.
        </p>
      </div>

      {connected && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Google Sheets back-up succesvol gekoppeld.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {ERROR_MESSAGES[error] ??
            "Koppelen van Google Sheets back-up is mislukt. Probeer opnieuw."}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        {status.connected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-green-700">
                Gekoppeld{status.email ? ` — ${status.email}` : ""}
              </span>
              <form action="/api/google-sheets-backup/disconnect" method="post">
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                >
                  Ontkoppelen
                </button>
              </form>
            </div>

            <div className="flex flex-col gap-1 text-slate-500">
              <span>Laatst gesynchroniseerd: {formatDateTime(status.lastSyncedAt)}</span>
              {status.lastSyncError && (
                <span className="text-red-600">
                  Laatste sync-fout: {status.lastSyncError}
                </span>
              )}
              {status.spreadsheetUrl ? (
                <a
                  href={status.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-fit items-center gap-1 text-blue-600 hover:underline"
                >
                  Open het back-up-sheet
                  <ExternalLink size={13} />
                </a>
              ) : (
                <span>
                  Het Google Sheets-bestand wordt aangemaakt bij de eerste
                  synchronisatie.
                </span>
              )}
            </div>

            <form action={triggerManualBackupSyncAction}>
              <button
                type="submit"
                className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Nu synchroniseren
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-slate-500">
              Nog niet gekoppeld. Verbind een Google-account (Beheerder) om de
              automatische back-up te activeren — de nachtelijke sync en de
              knop hierboven gebruiken daarna dat ene account, ongeacht wie
              er op dat moment ingelogd is.
            </p>
            <Link
              href="/api/google-sheets-backup/connect"
              className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Verbind Google Sheets
            </Link>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-400">
        Elke sync herschrijft elk tabblad volledig (headerrij, opmaak en
        databereik) — pas dus niets manueel aan in het sheet, want dat gaat
        bij de volgende sync verloren. Het Auditlog-tabblad beperkt zich tot
        de 5000 meest recente regels.
      </p>
    </div>
  );
}
