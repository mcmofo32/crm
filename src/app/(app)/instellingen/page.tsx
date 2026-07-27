import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ google_connected?: string; google_error?: string }>;
}) {
  const { google_connected, google_error } = await searchParams;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
  });

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">
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
    </div>
  );
}
