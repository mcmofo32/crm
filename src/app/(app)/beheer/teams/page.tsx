import { UserPlus, X } from "lucide-react";
import {
  getTeamsWithMembers,
  getCoachCandidates,
  getMemberCandidates,
  createTeamAction,
  addTeamMemberAction,
  removeTeamMemberAction,
} from "@/lib/actions/teams";
import { Avatar } from "@/components/Avatar";

export default async function TeamsPage() {
  const [teams, coachCandidates, memberCandidates] = await Promise.all([
    getTeamsWithMembers(),
    getCoachCandidates(),
    getMemberCandidates(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Teams</h1>
        <p className="text-base text-slate-500">
          Maak teams aan, duid een coach aan en voeg gebruikers toe als
          teamlid.
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {teams.map((team) => {
          const boundAddMember = addTeamMemberAction.bind(null, team.id);
          const availableMembers = memberCandidates.filter(
            (m) => m.teamId !== team.id
          );

          return (
            <div
              key={team.id}
              className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
            >
              <div>
                <h3 className="text-lg font-medium text-slate-900">
                  {team.name}
                </h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                  <Avatar name={team.coach.name} />
                  Coach: {team.coach.name}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {team.members.map((member) => {
                  const boundRemove = removeTeamMemberAction.bind(
                    null,
                    team.id,
                    member.id
                  );
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar name={member.name} />
                        <span className="text-sm text-slate-700">
                          {member.name}
                        </span>
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
                  <p className="text-sm text-slate-400">
                    Nog geen teamleden.
                  </p>
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
            </div>
          );
        })}
        {teams.length === 0 && (
          <p className="text-base text-slate-400">Nog geen teams.</p>
        )}
      </div>
    </div>
  );
}
