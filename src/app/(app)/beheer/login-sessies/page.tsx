import { redirect } from "next/navigation";
import Link from "next/link";
import { LogIn, Users, CalendarDays } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools, getDescendantUserIds } from "@/lib/permissions";
import { getLoginEvents, getLoginActivityByDay } from "@/lib/actions/sessions";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getProductionStructureOptions } from "@/lib/actions/production";
import { Avatar } from "@/components/Avatar";

export default async function LoginSessiesPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; medewerker?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

  const { team, medewerker } = await searchParams;

  const [assignableUsers, structureOptions] = await Promise.all([
    getAssignableUsers({ includeInactive: true }),
    getProductionStructureOptions(),
  ]);
  const medewerkerId =
    medewerker && assignableUsers.some((u) => u.id === medewerker)
      ? medewerker
      : undefined;
  const teamId =
    !medewerkerId && team && structureOptions.some((s) => s.id === team)
      ? team
      : undefined;
  const userIds = teamId
    ? [teamId, ...(await getDescendantUserIds(teamId))]
    : undefined;

  const [events, dailyActivity] = await Promise.all([
    getLoginEvents({ userId: medewerkerId, userIds }),
    medewerkerId ? getLoginActivityByDay(medewerkerId) : Promise.resolve(null),
  ]);
  const selectedMedewerker = medewerkerId
    ? assignableUsers.find((u) => u.id === medewerkerId)
    : undefined;

  function filterHref(next: { team?: string; medewerker?: string }) {
    const params = new URLSearchParams();
    if (next.team) params.set("team", next.team);
    if (next.medewerker) params.set("medewerker", next.medewerker);
    const qs = params.toString();
    return qs ? `/beheer/login-sessies?${qs}` : "/beheer/login-sessies";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <LogIn size={26} />
          Login-sessies
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Wanneer iedereen actief was in de CRM, per sessie (een nieuwe
          sessie start na 30 minuten zonder activiteit). Enkel zichtbaar voor
          Beheerder/Admin.
        </p>
      </div>

      <form
        method="GET"
        className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
      >
        <Users size={17} className="text-slate-400" />
        <select
          name="team"
          defaultValue={teamId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Alle teams</option>
          {structureOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          name="medewerker"
          defaultValue={medewerkerId ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Alle medewerkers</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Bekijken
        </button>
        {(teamId || medewerkerId) && (
          <Link
            href={filterHref({})}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            Filters wissen
          </Link>
        )}
      </form>

      {dailyActivity && (
        <div>
          <h2 className="mb-1 flex items-center gap-1.5 text-lg font-medium text-slate-900">
            <CalendarDays size={18} className="text-slate-400" />
            Activiteit per dag — laatste 30 dagen
            {selectedMedewerker && (
              <span className="font-normal text-slate-500">
                · {selectedMedewerker.name}
              </span>
            )}
          </h2>
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-base">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Datum</th>
                  <th className="px-6 py-3 font-medium">Actieve sessies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyActivity.map((day) => (
                  <tr
                    key={day.date.toISOString()}
                    className={day.sessionCount === 0 ? "text-slate-300" : undefined}
                  >
                    <td className="px-6 py-2.5 whitespace-nowrap text-slate-600">
                      {day.date.toLocaleDateString("nl-BE", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-2.5 font-medium">
                      {day.sessionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Sessie gestart</th>
              <th className="px-6 py-3 font-medium">Laatst actief</th>
              <th className="px-6 py-3 font-medium">Gebruiker</th>
              <th className="px-6 py-3 font-medium">E-mail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                  {event.createdAt.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                  {event.lastSeenAt.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={event.user.name} />
                    <span className="text-slate-700">{event.user.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {event.user.email || "—"}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  Nog geen activiteit geregistreerd.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
