import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import {
  updateMyZoomLinkAction,
  updateMyAvatarAction,
  removeMyAvatarAction,
} from "@/lib/actions/profile";
import { Avatar } from "@/components/Avatar";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "Google Agenda-integratie is niet geconfigureerd voor deze omgeving. Vraag de Beheerder om de Google-instellingen na te kijken.",
  invalid_state: "Koppelen van Google Agenda is mislukt. Probeer opnieuw.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>;
}) {
  const { google_connected, google_error } = await searchParams;
  const viewer = (await getEffectiveViewer())!;
  const user = await prisma.user.findUnique({
    where: { id: viewer.id },
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900">
        Instellingen
      </h1>

      {google_connected && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Google Agenda succesvol gekoppeld.
        </p>
      )}
      {google_error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {GOOGLE_ERROR_MESSAGES[google_error] ??
            "Koppelen van Google Agenda is mislukt. Probeer opnieuw."}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-medium text-slate-900">Mijn profielfoto</h2>
        <p className="mb-3 text-slate-500">
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
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="flex-1 cursor-pointer text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-slate-800"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
            >
              Uploaden
            </button>
          </form>
          {user?.avatarMimeType && (
            <form action={removeMyAvatarAction}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"
              >
                Verwijderen
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-medium text-slate-900">Google Agenda</h2>
        <p className="mb-3 text-slate-500">
          Koppel je Google Agenda zodat ingeplande telefoongesprekken en
          afspraken automatisch als agenda-item worden aangemaakt.
        </p>

        {user?.googleCalendarConnected ? (
          <div className="flex items-center justify-between">
            <span className="text-green-700">
              Gekoppeld{user.googleCalendarEmail ? ` — ${user.googleCalendarEmail}` : ""}
            </span>
            <form action="/api/google/disconnect" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
              >
                Ontkoppelen
              </button>
            </form>
          </div>
        ) : (
          <a
            href="/api/google/connect"
            className="inline-block rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Google Agenda koppelen
          </a>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <h2 className="mb-2 font-medium text-slate-900">Mijn Zoom-link</h2>
        <p className="mb-3 text-slate-500">
          Je eigen, persoonlijke Zoom-ruimte. Wanneer je via de
          planning-widget een online-afspraak inplant, wordt deze link
          automatisch in de omschrijving gezet (tenzij je daar kiest voor
          Google Meet).
        </p>
        <form action={updateMyZoomLinkAction} className="flex gap-2">
          <input
            type="url"
            name="zoomLink"
            defaultValue={user?.zoomLink ?? ""}
            placeholder="https://zoom.us/j/..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Opslaan
          </button>
        </form>
      </div>
    </div>
  );
}
