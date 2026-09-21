import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import {
  updateMyZoomLinkAction,
  updateMyAvatarAction,
  removeMyAvatarAction,
} from "@/lib/actions/profile";
import { getTheme } from "@/lib/actions/theme";
import { Avatar } from "@/components/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FormToast } from "@/components/toast/FormToast";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Google Agenda-integratie is niet geconfigureerd voor deze omgeving. Vraag de Beheerder om de Google-instellingen na te kijken.",
  invalid_state: "Koppelen van Google Agenda is mislukt. Probeer opnieuw.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    google_connected?: string;
    google_error?: string;
    google_error_detail?: string;
  }>;
}) {
  const { google_connected, google_error, google_error_detail } =
    await searchParams;
  const [viewer, theme] = await Promise.all([
    getEffectiveViewer().then((v) => v!),
    getTheme(),
  ]);
  const user = await prisma.user.findUnique({
    where: { id: viewer.id },
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-slate-100">
        Instellingen
      </h1>

      {google_connected && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
          Google Agenda succesvol gekoppeld.
        </p>
      )}
      {google_error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          <p>
            {GOOGLE_ERROR_MESSAGES[google_error] ??
              "Koppelen van Google Agenda is mislukt. Probeer opnieuw."}
          </p>
          {google_error_detail && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-400/80">
              Foutmelding: {google_error_detail}
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
          Thema
        </h2>
        <p className="mb-3 text-slate-500 dark:text-slate-400">
          Donkere modus is prettiger voor de ogen bij avond-/nachtwerk.
        </p>
        <ThemeToggle theme={theme} />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
          Mijn profielfoto
        </h2>
        <p className="mb-3 text-slate-500 dark:text-slate-400">
          Deze foto wordt getoond naast je naam, o.a. rechtsboven en op
          plekken waar je als eigenaar of teamlid vermeld staat.
        </p>
        <div className="flex items-center gap-4">
          <Avatar
            name={viewer.name}
            size="md"
            photoUrl={
              user?.avatarUpdatedAt
                ? `/api/users/${viewer.id}/avatar?v=${user.avatarUpdatedAt.getTime()}`
                : null
            }
          />
          <form
            action={updateMyAvatarAction}
            className="flex flex-1 flex-wrap items-center gap-2"
          >
            <FormToast message="Profielfoto opgeslagen" />
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="flex-1 cursor-pointer text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-slate-800 dark:text-slate-400 dark:file:bg-slate-100 dark:file:text-slate-900 dark:hover:file:bg-slate-300"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Uploaden
            </button>
          </form>
          {user?.avatarMimeType && (
            <form action={removeMyAvatarAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Verwijderen
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
          Google Agenda
        </h2>
        <p className="mb-3 text-slate-500 dark:text-slate-400">
          Koppel je Google Agenda zodat ingeplande telefoongesprekken en
          afspraken automatisch als agenda-item worden aangemaakt.
        </p>

        {user?.googleCalendarConnected ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-green-700 dark:text-green-400">
              Gekoppeld{user.googleCalendarEmail ? ` — ${user.googleCalendarEmail}` : ""}
            </span>
            <form action="/api/google/disconnect" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Ontkoppelen
              </button>
            </form>
          </div>
        ) : (
          <a
            href="/api/google/connect"
            className="inline-block rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Google Agenda koppelen
          </a>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
          Mijn Zoom-link
        </h2>
        <p className="mb-3 text-slate-500 dark:text-slate-400">
          Je eigen, persoonlijke Zoom-ruimte. Wanneer je via de
          planning-widget een online-afspraak inplant, wordt deze link
          automatisch in de omschrijving gezet (tenzij je daar kiest voor
          Google Meet).
        </p>
        <form action={updateMyZoomLinkAction} className="flex gap-2">
          <FormToast message="Zoom-link opgeslagen" />
          <input
            type="url"
            name="zoomLink"
            defaultValue={user?.zoomLink ?? ""}
            placeholder="https://zoom.us/j/..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Opslaan
          </button>
        </form>
      </div>
    </div>
  );
}
