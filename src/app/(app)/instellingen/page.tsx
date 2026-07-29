import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canManageSettings } from "@/lib/permissions";
import { getZoomLink, updateZoomLinkAction } from "@/lib/actions/companySettings";

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
  const zoomLink = canManageSettings(viewer) ? await getZoomLink() : null;

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
          Koppelen van Google Agenda is mislukt. Probeer opnieuw.
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
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

      {canManageSettings(viewer) && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-2 font-medium text-slate-900">
            Zoom-link (bedrijfsbreed)
          </h2>
          <p className="mb-3 text-slate-500">
            Deze link wordt automatisch toegevoegd aan online-afspraken die
            via de planning-widget worden ingepland (tenzij daar gekozen wordt
            voor Google Meet).
          </p>
          <form action={updateZoomLinkAction} className="flex gap-2">
            <input
              type="url"
              name="zoomLink"
              defaultValue={zoomLink ?? ""}
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
      )}
    </div>
  );
}
