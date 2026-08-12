import { redirect } from "next/navigation";
import { MonitorSmartphone } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder } from "@/lib/permissions";
import { getActiveSessions, forceLogoutUserAction } from "@/lib/actions/sessions";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

export default async function ActiveSessionsPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!isBeheerder(viewer)) redirect("/dashboard");

  const sessions = await getActiveSessions();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <MonitorSmartphone size={26} />
          Actieve sessies
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Wie momenteel via Google ingelogd is (sessies zijn 30 dagen
          geldig). Enkel zichtbaar voor de Beheerder. Uitloggen dwingt een
          nieuwe Google-login af bij de eerstvolgende paginanavigatie van
          die persoon.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium">Laatste login</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <Avatar name={s.name} />
                    <div className="flex flex-col leading-tight">
                      <span>{s.name}</span>
                      {s.email && (
                        <span className="text-xs font-normal text-slate-400">
                          {s.email}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {ROLE_LABELS[s.role as keyof typeof ROLE_LABELS]}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {s.lastLoginAt
                    ? s.lastLoginAt.toLocaleString("nl-BE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Nooit ingelogd"}
                </td>
                <td className="px-6 py-4">
                  <Badge variant={s.loggedIn ? "green" : "slate"}>
                    {s.loggedIn ? "Ingelogd" : "Uitgelogd"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  {s.loggedIn && (
                    <form action={forceLogoutUserAction.bind(null, s.id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                      >
                        Uitloggen
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  Geen gebruikers gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
