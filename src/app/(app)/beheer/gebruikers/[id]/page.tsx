import { notFound } from "next/navigation";
import Link from "next/link";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder, canEditAccount, canChangeRole } from "@/lib/permissions";
import {
  getUserForEdit,
  getTeamsForAssignment,
  updateUserAction,
  setUserActiveAction,
  getUserDeletionImpact,
  getReassignableUsers,
} from "@/lib/actions/users";
import { forceLogoutUserAction } from "@/lib/actions/sessions";
import { getFsmaModulesForUser, setFsmaModuleStatusAction } from "@/lib/actions/fsmaModules";
import { AgentType, JobFunction, Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { JOB_FUNCTION_LABELS } from "@/lib/jobFunctionLabels";
import {
  FSMA_MODULE_LABELS,
  FSMA_STATUS_ORDER,
  FSMA_STATUS_LABELS,
  FSMA_STATUS_COLORS,
} from "@/lib/fsmaLabels";
import { EditUserForm } from "@/components/EditUserForm";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { InlineSelect } from "@/components/InlineSelect";

const FSMA_STATUS_OPTIONS = FSMA_STATUS_ORDER.map((status) => ({
  value: status,
  label: FSMA_STATUS_LABELS[status],
  style: FSMA_STATUS_COLORS[status],
}));

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

  // Enkel de Beheerder mag een Beheerder-account bewerken — een Admin mag
  // verder iedereen, ook een andere Admin (canEditAccount). De rol zelf is
  // een aparte, strengere regel (canChangeRole hieronder): enkel de
  // Beheerder mag de rol van een bestaande Admin/Beheerder aanpassen, dus
  // ook enkel de Beheerder mag de Admin-rol afnemen. De write-acties zelf
  // (updateUserAction, setUserActiveAction, deleteUserAction) controleren
  // dit ook zelf nog eens server-side.
  const canEdit = canEditAccount(viewer, target);
  const canEditRole = canChangeRole(viewer, target, target.role);
  const isSelf = target.id === viewer.id;
  const [deletionImpact, reassignableUsers, fsmaModules] = await Promise.all([
    isSelf ? null : getUserDeletionImpact(id),
    isSelf ? [] : getReassignableUsers(id),
    getFsmaModulesForUser(id),
  ]);

  // Een Admin mag rollen aanpassen tot maximaal Coach (nooit Admin/Beheerder
  // toekennen) — maar enkel als de rol van dit profiel zelf al aanpasbaar is
  // (canEditRole); is dat niet zo (bv. dit profiel is zelf een Admin), dan
  // toont de select enkel de huidige rol, vast en niet aanpasbaar.
  const assignableRoles: Role[] = !canEditRole
    ? [target.role]
    : actorRole === Role.BEHEERDER
    ? [Role.BEHEERDER, Role.ADMIN, Role.COACH, Role.USER]
    : [Role.COACH, Role.USER];

  const boundUpdate = updateUserAction.bind(null, id);
  const boundToggleActive = setUserActiveAction.bind(null, id, !target.active);
  const boundForceLogout = forceLogoutUserAction.bind(null, id);

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          {canEdit ? "Medewerker bewerken" : "Medewerker bekijken"}
        </h1>
        <p className="text-sm text-slate-500">
          {target.email || <span className="text-slate-300">Geen e-mailadres</span>}
        </p>
      </div>

      {!canEdit && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Enkel de Beheerder mag dit profiel bewerken. Je kan het wel bekijken.
        </div>
      )}

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
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">E-mail</label>
          <input
            name="email"
            type="email"
            defaultValue={target.email ?? ""}
            required
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
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
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Rol</label>
          <select
            name="role"
            defaultValue={target.role}
            required
            disabled={!canEditRole}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {/* Een disabled <select> wordt niet mee opgestuurd bij een submit
              — zonder dit zou de rol als leeg binnenkomen (en de update laten
              crashen) zodra enkel andere velden bewerkt worden. */}
          {!canEditRole && <input type="hidden" name="role" value={target.role} />}
          {canEdit && !canEditRole && (
            <p className="text-xs text-slate-400">
              Enkel de Beheerder mag de rol van dit profiel aanpassen.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Functie <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <select
            name="jobFunction"
            defaultValue={target.jobFunction ?? ""}
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
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
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
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
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
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

        <hr className="my-1 border-slate-100" />
        <p className="-mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Makelaarskantoor
        </p>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Aanbrengnummer <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            name="referralNumber"
            defaultValue={target.referralNumber ?? ""}
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            OVB-nummer <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            name="ovbNumber"
            defaultValue={target.ovbNumber ?? ""}
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Naam onderneming <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            name="companyName"
            defaultValue={target.companyName ?? ""}
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Ondernemingsnummer <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            name="companyRegistrationNumber"
            defaultValue={target.companyRegistrationNumber ?? ""}
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Maatschappelijke zetel <span className="font-normal text-slate-400">(optioneel)</span>
          </label>
          <input
            name="registeredOffice"
            defaultValue={target.registeredOffice ?? ""}
            disabled={!canEdit}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>

        {canEdit && (
          <button
            type="submit"
            className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
          >
            Wijzigingen opslaan
          </button>
        )}
      </EditUserForm>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-medium text-slate-900">FSMA-modules</h2>
        <p className="mb-3 text-sm text-slate-500">
          Status van de verplichte vakbekwaamheidsmodules voor deze medewerker.
        </p>
        <div className="flex flex-col divide-y divide-slate-100">
          {fsmaModules.map((row) => (
            <div
              key={row.module}
              className="grid grid-cols-[1fr_auto] items-center gap-4 py-2.5"
            >
              <span className="text-slate-700">{FSMA_MODULE_LABELS[row.module]}</span>
              <InlineSelect
                action={setFsmaModuleStatusAction.bind(null, target.id, row.module)}
                name="status"
                value={row.status}
                options={FSMA_STATUS_OPTIONS}
                className="w-56 flex-shrink-0 rounded-md border-0 px-2 py-1.5 text-sm font-medium"
                style={FSMA_STATUS_COLORS[row.status]}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-900">Status</h2>
        <p className="mb-3 text-sm text-slate-500">
          {target.active
            ? "Deze gebruiker is actief en kan inloggen."
            : "Deze gebruiker is inactief en kan niet meer inloggen."}
        </p>
        {canEdit && (
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
        )}
      </div>

      {isBeheerder(viewer) && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-900">
            Sessie beëindigen
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Beëindigt de huidige ingelogde sessie van deze gebruiker meteen —
            die persoon moet dan opnieuw via Google inloggen bij de
            eerstvolgende paginanavigatie. Enkel zichtbaar voor de Beheerder.
          </p>
          <form action={boundForceLogout}>
            <button
              type="submit"
              className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Sessie beëindigen
            </button>
          </form>
        </div>
      )}

      {canEdit && !isSelf && deletionImpact && (
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
