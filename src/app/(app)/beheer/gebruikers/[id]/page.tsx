import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveViewer } from "@/lib/impersonation";
import {
  getUserForEdit,
  getTeamsForAssignment,
  updateUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  getUserDeletionImpact,
  getReassignableUsers,
} from "@/lib/actions/users";
import { AgentType, JobFunction, Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { JOB_FUNCTION_LABELS } from "@/lib/jobFunctionLabels";
import { EditUserForm } from "@/components/EditUserForm";
import { DeleteUserButton } from "@/components/DeleteUserButton";

const JOB_FUNCTIONS = Object.values(JobFunction);
const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  ANALYST: "Analyst",
  SUBAGENT: "Subagent",
};

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = (await getEffectiveViewer())!;
  const actorRole = viewer.role;

  const [target, teams] = await Promise.all([
    getUserForEdit(id),
    getTeamsForAssignment(),
  ]);
  if (!target) notFound();

  const isSelf = target.id === viewer.id;
  const [deletionImpact, reassignableUsers] = await Promise.all([
    isSelf ? null : getUserDeletionImpact(id),
    isSelf ? [] : getReassignableUsers(id),
  ]);

  // Enkel de Beheerder mag iemand Admin maken (gevoelige data, bewust beperkt tot 1 persoon).
  const assignableRoles = (
    actorRole === Role.BEHEERDER
      ? [Role.BEHEERDER, Role.ADMIN, Role.COACH, Role.USER]
      : [Role.COACH, Role.USER]
  ) as Role[];

  const boundUpdate = updateUserAction.bind(null, id);
  const boundResetPassword = resetUserPasswordAction.bind(null, id);
  const boundToggleActive = setUserActiveAction.bind(null, id, !target.active);

  return (
    <div className="max-w-lg flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Gebruiker bewerken
        </h1>
        <p className="text-sm text-slate-500">
          {target.email || <span className="text-slate-300">Geen e-mailadres</span>}
        </p>
      </div>

      {/* key op updatedAt: dwingt een volledige remount af na een geslaagde
          opslag, zodat de defaultValue-velden (Rol/Functie/Type/Team) de
          effectief opgeslagen waarde tonen i.p.v. de oude DOM-waarde te
          behouden — defaultValue wordt door React enkel bij mount toegepast. */}
      <EditUserForm key={target.updatedAt.getTime()} action={boundUpdate}>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Naam</label>
          <input
            name="name"
            defaultValue={target.name}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">E-mail</label>
          <input
            name="email"
            type="email"
            defaultValue={target.email ?? ""}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Telefoon <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            name="phone"
            type="tel"
            defaultValue={target.phone ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Rol</label>
          <select
            name="role"
            defaultValue={target.role}
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Functie <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <select
            name="jobFunction"
            defaultValue={target.jobFunction ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Geen</option>
            {JOB_FUNCTIONS.map((jf) => (
              <option key={jf} value={jf}>
                {JOB_FUNCTION_LABELS[jf]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Type</label>
          <select
            name="agentType"
            defaultValue={target.agentType}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {Object.values(AgentType).map((type) => (
              <option key={type} value={type}>
                {AGENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Team (voor rol &quot;User&quot; of &quot;Coach&quot;)
          </label>
          <select
            name="teamId"
            defaultValue={target.teamId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Geen team</option>
            {teams
              .filter((team) => team.coachId !== target.id)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} (coach: {team.coach.name})
                </option>
              ))}
          </select>
          <p className="text-xs text-slate-400">
            Kies dit voor een Coach om aan te geven dat die zelf ook
            rapporteert aan de coach van dit team (meerlaagse structuur).
          </p>
        </div>
        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Wijzigingen opslaan
        </button>
      </EditUserForm>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-900">Status</h2>
        <p className="mb-3 text-sm text-slate-500">
          {target.active
            ? "Deze gebruiker is actief en kan inloggen."
            : "Deze gebruiker is inactief en kan niet meer inloggen."}
        </p>
        <form action={boundToggleActive}>
          <button
            type="submit"
            className={
              target.active
                ? "rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                : "rounded-md border border-green-300 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50"
            }
          >
            {target.active ? "Account inactief zetten" : "Account activeren"}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-900">
          Wachtwoord resetten
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Stelt een nieuw wachtwoord in voor deze gebruiker. Geef dit
          persoonlijk door; de gebruiker kan het nadien zelf niet zelf
          wijzigen in deze eerste versie.
        </p>
        <form action={boundResetPassword} className="flex gap-2 text-sm">
          <input
            name="password"
            type="password"
            minLength={8}
            required
            placeholder="Nieuw wachtwoord"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Resetten
          </button>
        </form>
      </div>

      {!isSelf && deletionImpact && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-medium text-red-900">
            Gevarenzone — profiel verwijderen
          </h2>
          {deletionImpact.coachesTeam ? (
            <p className="text-sm text-red-800">
              Deze gebruiker coacht nog een team. Verwijder of herverdeel dat
              team eerst via{" "}
              <Link href="/beheer/teams" className="underline">
                Teams
              </Link>{" "}
              voor je dit profiel kan verwijderen.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-red-800">
                Het account kan nadien niet meer inloggen en verdwijnt uit
                alle keuzelijsten. Alle bestaande historiek (activiteiten,
                logboek, klanten/leads, ...) blijft gewoon bewaard, ook als
                je de klanten hieronder niet overzet naar een collega.
              </p>
              <DeleteUserButton
                userId={target.id}
                userName={target.name}
                leadsCount={
                  deletionImpact.ownedLeadsCount +
                  deletionImpact.caseManagedLeadsCount
                }
                reassignableUsers={reassignableUsers}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
