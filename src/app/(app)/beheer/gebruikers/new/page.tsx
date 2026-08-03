import { getEffectiveViewer } from "@/lib/impersonation";
import {
  createUserAction,
  getTeamsForAssignment,
  getUserBasicInfo,
} from "@/lib/actions/users";
import { JobFunction, Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/roleLabels";

const JOB_FUNCTIONS = Object.values(JobFunction);

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ under?: string }>;
}) {
  const { under } = await searchParams;
  const actor = (await getEffectiveViewer())!;
  const [teams, underPerson] = await Promise.all([
    getTeamsForAssignment(),
    under ? getUserBasicInfo(under) : Promise.resolve(null),
  ]);

  const assignableRoles = (
    actor.role === Role.BEHEERDER
      ? [Role.BEHEERDER, Role.ADMIN, Role.COACH, Role.USER]
      : [Role.ADMIN, Role.COACH, Role.USER]
  ) as Role[];

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900">
        Nieuwe gebruiker
      </h1>
      <form action={createUserAction} className="flex flex-col gap-4 text-sm">
        {underPerson && <input type="hidden" name="underId" value={underPerson.id} />}
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Naam</label>
          <input
            name="name"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            E-mail <span className="font-normal text-slate-400">(optioneel, mag later toegevoegd worden)</span>
          </label>
          <input
            name="email"
            type="email"
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
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Rol</label>
          <select
            name="role"
            required
            defaultValue={Role.USER}
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
            defaultValue=""
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">Geen</option>
            {JOB_FUNCTIONS.map((jf) => (
              <option key={jf} value={jf}>
                {jf}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isSubagent" className="h-4 w-4 rounded border-slate-300" />
          Subagent (werkt onder het nummer van een andere agent)
        </label>
        {underPerson ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Wordt automatisch geplaatst onder <strong>{underPerson.name}</strong>.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">
              Team (voor rol &quot;User&quot; of &quot;Coach&quot;)
            </label>
            <select
              name="teamId"
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Geen team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} (coach: {team.coach.name})
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-xs text-slate-400">
          Kies je &quot;Coach&quot; als rol, dan wordt automatisch een nieuw
          team voor deze coach aangemaakt. Kies je hierboven ook nog een team,
          dan wordt deze coach zelf lid van dat team — zo bouw je een
          meerlaagse structuur op (bv. een coach die op zijn beurt rapporteert
          aan een andere coach).
        </p>
        <p className="text-xs text-slate-400">
          Tijdelijk wachtwoord: <code>veranderditwachtwoord123</code>. De
          gebruiker wijzigt dit best zelf na de eerste login.
        </p>
        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Gebruiker aanmaken
        </button>
      </form>
    </div>
  );
}
