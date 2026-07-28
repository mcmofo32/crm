import { auth } from "@/lib/auth";
import { createUserAction, getTeamsForAssignment } from "@/lib/actions/users";
import { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/roleLabels";

export default async function NewUserPage() {
  const session = await auth();
  const actor = session!.user;
  const teams = await getTeamsForAssignment();

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
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Naam</label>
          <input
            name="name"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">E-mail</label>
          <input
            name="email"
            type="email"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Tijdelijk wachtwoord
          </label>
          <input
            name="password"
            type="password"
            minLength={8}
            required
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
            Team (enkel voor rol &quot;User&quot;)
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
        <p className="text-xs text-slate-400">
          Kies je &quot;Coach&quot; als rol, dan wordt automatisch een nieuw
          team voor deze coach aangemaakt.
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
