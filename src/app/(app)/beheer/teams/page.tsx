import { UserPlus, X, Pencil, ChevronRight, MoreVertical } from "lucide-react";
import {
  getTeamsWithMembers,
  getCoachCandidates,
  getCoachChangeCandidates,
  getMemberCandidates,
  getStructureMembers,
  createTeamAction,
  changeTeamCoachAction,
  addTeamMemberAction,
  removeTeamMemberAction,
} from "@/lib/actions/teams";
import {
  getSubagents,
  createSubagentAction,
  deleteSubagentAction,
} from "@/lib/actions/subagents";
import { Avatar } from "@/components/Avatar";
import { DeleteTeamButton } from "@/components/DeleteTeamButton";

type TeamWithMembers = Awaited<ReturnType<typeof getTeamsWithMembers>>[number];
type MemberCandidate = Awaited<ReturnType<typeof getMemberCandidates>>[number];
type SubagentRecord = Awaited<ReturnType<typeof getSubagents>>[number];

async function TeamCard({
  team,
  teamByCoachId,
  memberCandidates,
  subagents,
  seenTeamIds = new Set(),
}: {
  team: TeamWithMembers;
  teamByCoachId: Map<string, TeamWithMembers>;
  memberCandidates: MemberCandidate[];
  subagents: SubagentRecord[];
  seenTeamIds?: Set<string>;
}) {
  if (seenTeamIds.has(team.id)) return null;
  const nextSeen = new Set(seenTeamIds).add(team.id);

  const coachChangeCandidates = await getCoachChangeCandidates(team.id);
  const structureMembers = await getStructureMembers(team.id);
  const boundAddMember = addTeamMemberAction.bind(null, team.id);
  const boundChangeCoach = changeTeamCoachAction.bind(null, team.id);
  const availableMembers = memberCandidates.filter(
    (m) => m.teamId !== team.id && m.id !== team.coachId
  );
  const teamSubagents = subagents.filter((s) => s.teamId === team.id);
  const boundAddSubagent = createSubagentAction.bind(null, team.id);

  // Sub-structuren: teamleden die zelf ook coach zijn, met hun eigen team —
  // die tonen we genest in deze kaart i.p.v. als apart, los vak op de pagina.
  const subTeams = team.members
    .filter((m) => m.role === "COACH")
    .map((m) => teamByCoachId.get(m.id))
    .filter((t): t is TeamWithMembers => Boolean(t));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium text-slate-900">{team.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <Avatar name={team.coach.name} />
            Coach: {team.coach.name}
          </div>
        </div>
        <details className="group/menu relative">
          <summary
            title="Team-opties"
            className="flex cursor-pointer list-none rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden"
          >
            <MoreVertical size={18} />
          </summary>
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-100">
                <Pencil size={14} />
                Coach wijzigen
              </summary>
              <form
                action={boundChangeCoach}
                className="mt-2 flex flex-col gap-2 px-2 pb-2"
              >
                <select
                  name="coachId"
                  required
                  defaultValue=""
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="" disabled>
                    Kies nieuwe coach
                  </option>
                  {coachChangeCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                      {c.role === "COACH" ? " · Coach" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Wijzigen
                </button>
              </form>
              {coachChangeCandidates.length === 0 && (
                <p className="px-2 pb-2 text-xs text-slate-400">
                  Niemand beschikbaar om als nieuwe coach aan te duiden.
                </p>
              )}
            </details>
            <hr className="my-1 border-slate-100" />
            <DeleteTeamButton
              teamId={team.id}
              teamName={team.name}
              memberCount={team.members.length}
              variant="menu-item"
            />
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-2">
        {team.members.map((member) => {
          const boundRemove = removeTeamMemberAction.bind(null, team.id, member.id);
          return (
            <div
              key={member.id}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Avatar name={member.name} />
                <span className="text-sm text-slate-700">{member.name}</span>
                {member.role === "COACH" && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Coach — heeft zelf ook een team
                  </span>
                )}
              </div>
              <form action={boundRemove}>
                <button
                  type="submit"
                  title="Verwijder uit team"
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                >
                  <X size={16} />
                </button>
              </form>
            </div>
          );
        })}
        {team.members.length === 0 && (
          <p className="text-sm text-slate-400">Nog geen teamleden.</p>
        )}
      </div>

      <form
        action={boundAddMember}
        className="flex items-center gap-2 border-t border-slate-100 pt-3"
      >
        <select
          name="userId"
          required
          defaultValue=""
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Kies gebruiker
          </option>
          {availableMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.email})
              {m.role === "COACH" ? " · Coach" : ""}
              {m.teamId ? " · andere team" : ""}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <UserPlus size={16} />
          Toevoegen
        </button>
      </form>

      <div className="border-t border-slate-100 pt-3">
        <h4 className="mb-2 text-sm font-medium text-slate-900">Subagenten</h4>
        <p className="mb-2 text-xs text-slate-400">
          Kunnen bij een adviesgesprek mee uitgenodigd worden om te closen.
        </p>
        <div className="flex flex-col gap-2">
          {teamSubagents.map((subagent) => {
            const boundDelete = deleteSubagentAction.bind(null, subagent.id);
            return (
              <div
                key={subagent.id}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
              >
                <div className="text-sm text-slate-700">
                  <div className="font-medium">{subagent.name}</div>
                  <div className="text-xs text-slate-400">
                    {subagent.email}
                    {subagent.phone ? ` · ${subagent.phone}` : ""}
                  </div>
                </div>
                <form action={boundDelete}>
                  <button
                    type="submit"
                    title="Subagent verwijderen"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </form>
              </div>
            );
          })}
          {teamSubagents.length === 0 && (
            <p className="text-sm text-slate-400">Nog geen subagenten.</p>
          )}
        </div>
        <form action={boundAddSubagent} className="mt-2 grid grid-cols-2 gap-2">
          <input
            name="name"
            placeholder="Naam"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="E-mail"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="phone"
            placeholder="Telefoon (optioneel)"
            className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <UserPlus size={16} />
            Subagent toevoegen
          </button>
        </form>
      </div>

      {subTeams.length > 0 && (
        <details className="group border-t border-slate-100 pt-3">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-slate-900">
            <ChevronRight
              size={15}
              className="text-slate-400 transition-transform group-open:rotate-90"
            />
            Iedereen in deze structuur ({structureMembers.length})
          </summary>
          <div className="mb-4 flex flex-wrap gap-2">
            {structureMembers.map((m) => (
              <span
                key={m.id}
                className="flex items-center gap-1.5 rounded-full bg-slate-50 py-1 pl-1 pr-2.5 text-xs text-slate-600"
              >
                <Avatar name={m.name} size="sm" />
                {m.name}
                {m.role === "COACH" && (
                  <span className="text-amber-600">· Coach</span>
                )}
              </span>
            ))}
          </div>
        </details>
      )}

      {subTeams.length > 0 && (
        <details className="group border-t border-slate-100 pt-3">
          <summary className="mb-3 flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-slate-900">
            <ChevronRight
              size={15}
              className="text-slate-400 transition-transform group-open:rotate-90"
            />
            Sub-structuren ({subTeams.length})
          </summary>
          <div className="flex flex-col gap-4 border-l-2 border-slate-200 pl-4">
            {subTeams.map((subTeam) => (
              <TeamCard
                key={subTeam.id}
                team={subTeam}
                teamByCoachId={teamByCoachId}
                memberCandidates={memberCandidates}
                subagents={subagents}
                seenTeamIds={nextSeen}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default async function TeamsPage() {
  const [teams, coachCandidates, memberCandidates, subagents] = await Promise.all([
    getTeamsWithMembers(),
    getCoachCandidates(),
    getMemberCandidates(),
    getSubagents(),
  ]);

  const teamByCoachId = new Map(teams.map((t) => [t.coachId, t]));
  // Root-structuren: teams waarvan de coach zelf nergens teamlid van is —
  // hun eventuele sub-coaches (en diens teams) worden genest getoond i.p.v.
  // als los, apart vak op de pagina.
  const rootTeams = teams.filter((t) => !t.coach.teamId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Teams</h1>
        <p className="text-base text-slate-500">
          Maak teams aan, duid een coach aan en voeg gebruikers toe als
          teamlid. Een teamlid die zelf ook coach is, wordt genest getoond
          onder zijn eigen structuur.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Nieuw team aanmaken
        </h2>
        <form
          action={createTeamAction}
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <input
            name="name"
            placeholder="Teamnaam"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
          />
          <select
            name="coachId"
            required
            defaultValue=""
            className="rounded-md border border-slate-300 px-3 py-2 text-base"
          >
            <option value="" disabled>
              Kies coach
            </option>
            {coachCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-base font-medium text-white hover:bg-slate-800"
          >
            Team aanmaken
          </button>
        </form>
        {coachCandidates.length === 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Er zijn geen gebruikers meer beschikbaar om als coach aan te
            duiden — elke geschikte gebruiker leidt al een team.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {rootTeams.map((team) => (
          <TeamCard
            key={team.id}
            team={team}
            teamByCoachId={teamByCoachId}
            memberCandidates={memberCandidates}
            subagents={subagents}
          />
        ))}
        {rootTeams.length === 0 && (
          <p className="text-base text-slate-400">Nog geen teams.</p>
        )}
      </div>
    </div>
  );
}
