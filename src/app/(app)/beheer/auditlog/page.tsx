import { redirect } from "next/navigation";
import Link from "next/link";
import { ScrollText, Users } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools, getDescendantUserIds } from "@/lib/permissions";
import { getAuditLog } from "@/lib/audit";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getProductionStructureOptions } from "@/lib/actions/production";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

const ACTION_LABELS: Record<string, string> = {
  "lead.created": "Lead aangemaakt",
  "lead.updated": "Lead gewijzigd",
  "lead.deleted": "Lead verwijderd",
  "lead.restored": "Lead hersteld",
  "user.created": "Gebruiker aangemaakt",
  "user.updated": "Gebruiker gewijzigd",
  "user.activated": "Gebruiker geactiveerd",
  "user.deactivated": "Gebruiker gedeactiveerd",
  "user.deleted": "Gebruiker verwijderd",
  "user.password_reset": "Wachtwoord gereset",
  "team.created": "Team aangemaakt",
  "team.member_added": "Lid toegevoegd",
  "team.member_removed": "Lid verwijderd",
  "activity.deleted": "Activiteit verwijderd",
};

const ENTITY_FILTERS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Alle" },
  { value: "Lead", label: "Leads" },
  { value: "User", label: "Gebruikers" },
  { value: "Team", label: "Teams" },
  { value: "Activity", label: "Activiteiten" },
];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; team?: string; medewerker?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

  const { type, team, medewerker } = await searchParams;

  const [assignableUsers, structureOptions] = await Promise.all([
    getAssignableUsers(),
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
  const actorIds = teamId
    ? [teamId, ...(await getDescendantUserIds(teamId))]
    : undefined;

  const entries = await getAuditLog(type, {
    actorId: medewerkerId,
    actorIds,
  });

  function entityFilterHref(filterValue: string | undefined) {
    const params = new URLSearchParams();
    if (filterValue) params.set("type", filterValue);
    if (teamId) params.set("team", teamId);
    if (medewerkerId) params.set("medewerker", medewerkerId);
    const qs = params.toString();
    return qs ? `/beheer/auditlog?${qs}` : "/beheer/auditlog";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <ScrollText size={26} />
          Logboek
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Belangrijke beheersacties. Enkel zichtbaar voor Beheerder/Admin.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-base">
          {ENTITY_FILTERS.map((filter) => (
            <Link
              key={filter.label}
              href={entityFilterHref(filter.value)}
              className={`rounded-full px-4 py-1.5 ${
                type === filter.value || (!type && !filter.value)
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        <form
          method="GET"
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
        >
          {type && <input type="hidden" name="type" value={type} />}
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
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Datum</th>
              <th className="px-6 py-3 font-medium">Actie</th>
              <th className="px-6 py-3 font-medium">Door</th>
              <th className="px-6 py-3 font-medium">Beschrijving</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                  {entry.createdAt.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-6 py-4">
                  <Badge variant="slate">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={entry.actor.name} />
                    <span className="text-slate-700">{entry.actor.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {entry.description}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  Nog geen acties gelogd.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
