import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder } from "@/lib/permissions";
import { getAnalytics } from "@/lib/actions/analytics";
import {
  LEAD_TYPE_LABELS,
  ROLE_LABELS,
  ROLE_BADGE_VARIANT,
  conversionBadgeVariant,
} from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

const STAGE_COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#a21caf", "#c026d3"];

export default async function AnalysePage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; person?: string }>;
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!isBeheerder(viewer)) redirect("/dashboard");

  const { team: teamFilter, person: personFilter } = await searchParams;
  const { byType, stageDistribution, perEmployee, teams } = await getAnalytics();
  const maxStageCount = Math.max(1, ...stageDistribution.map((s) => s.count));

  const filteredEmployees = personFilter
    ? perEmployee.filter((e) => e.id === personFilter)
    : !teamFilter || teamFilter === "alle"
    ? perEmployee
    : teamFilter === "geen"
    ? perEmployee.filter((e) => !e.teamId)
    : perEmployee.filter((e) => e.teamId === teamFilter);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <BarChart3 size={26} />
          Analyse
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Conversie en prestaties. Enkel zichtbaar voor de Beheerder.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {(["FA", "RG"] as const).map((type) => {
          const stats = byType[type];
          return (
            <div
              key={type}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <h2 className="mb-4 text-lg font-medium text-slate-900">
                {LEAD_TYPE_LABELS[type]}
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Totaal" value={stats.total} />
                <Stat label="Open" value={stats.open} />
                <Stat label="Gewonnen" value={stats.won} />
                <Stat label="Verloren" value={stats.lost} />
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                <span className="text-sm text-slate-500">Conversieratio</span>
                <Badge variant={conversionBadgeVariant(stats.conversionRate)}>
                  {stats.conversionRate === null
                    ? "Nog geen beslissing"
                    : `${stats.conversionRate}%`}
                </Badge>
                <span className="text-xs text-slate-400">
                  (gewonnen / gewonnen+verloren)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-medium text-slate-900">
          Open leads per fase
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Waar leads momenteel blijven hangen, per funnel.
        </p>
        <div className="flex flex-col gap-3">
          {stageDistribution.map((bucket, i) => (
            <div
              key={`${bucket.leadType}:${bucket.label}`}
              className="flex items-center gap-3"
            >
              <span className="w-40 flex-shrink-0 text-sm text-slate-600">
                <span className="mr-1.5 text-xs text-slate-400">
                  {LEAD_TYPE_LABELS[bucket.leadType]}
                </span>
                {bucket.label}
              </span>
              <div className="h-3 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${Math.max(4, (bucket.count / maxStageCount) * 100)}%`,
                    backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length],
                  }}
                />
              </div>
              <span className="w-8 flex-shrink-0 text-right text-sm font-medium text-slate-700">
                {bucket.count}
              </span>
            </div>
          ))}
          {stageDistribution.length === 0 && (
            <p className="text-sm text-slate-400">Geen open leads.</p>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-slate-900">
              Overzicht per medewerker
            </h2>
            <form method="GET" className="flex items-center gap-2 text-sm">
              <select
                name="person"
                defaultValue={personFilter ?? ""}
                className="rounded-md border border-slate-300 px-3 py-1.5"
              >
                <option value="">Alle medewerkers</option>
                {perEmployee.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
              >
                Bekijken
              </button>
            </form>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link
              href="/beheer/analyse"
              className={`rounded-full px-3 py-1.5 ${
                !personFilter && (!teamFilter || teamFilter === "alle")
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Alle teams
            </Link>
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/beheer/analyse?team=${team.id}`}
                className={`rounded-full px-3 py-1.5 ${
                  !personFilter && teamFilter === team.id
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600"
                }`}
              >
                {team.name}
              </Link>
            ))}
            <Link
              href="/beheer/analyse?team=geen"
              className={`rounded-full px-3 py-1.5 ${
                !personFilter && teamFilter === "geen"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Zonder team
            </Link>
          </div>
        </div>
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium">Team</th>
              <th className="px-6 py-3 font-medium">Leads</th>
              <th className="px-6 py-3 font-medium">Gewonnen</th>
              <th className="px-6 py-3 font-medium">Verloren</th>
              <th className="px-6 py-3 font-medium">Conversie</th>
              <th className="px-6 py-3 font-medium">Afgeronde contacten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEmployees.map((employee) => (
              <tr key={employee.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <Avatar name={employee.name} />
                    {employee.name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={ROLE_BADGE_VARIANT[employee.role]}>
                    {ROLE_LABELS[employee.role]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {employee.teamName ?? "—"}
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {employee.totalLeads}
                </td>
                <td className="px-6 py-4 text-slate-700">{employee.won}</td>
                <td className="px-6 py-4 text-slate-700">{employee.lost}</td>
                <td className="px-6 py-4">
                  <Badge variant={conversionBadgeVariant(employee.conversionRate)}>
                    {employee.conversionRate === null
                      ? "—"
                      : `${employee.conversionRate}%`}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-700">
                  {employee.activitiesCompleted}
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  Geen gebruikers in dit team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
