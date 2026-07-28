import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getUserForEdit,
  getTeamsForAssignment,
  updateUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
} from "@/lib/actions/users";
import { Role } from "@/generated/prisma/client";
import { ROLE_LABELS } from "@/lib/roleLabels";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const actorRole = session!.user.role;

  const [target, teams] = await Promise.all([
    getUserForEdit(id),
    getTeamsForAssignment(),
  ]);
  if (!target) notFound();

  const assignableRoles = (
    actorRole === Role.BEHEERDER
      ? [Role.BEHEERDER, Role.ADMIN, Role.COACH, Role.USER]
      : [Role.ADMIN, Role.COACH, Role.USER]
  ) as Role[];

  const boundUpdate = updateUserAction.bind(null, id);
  const boundResetPassword = resetUserPasswordAction.bind(null, id);
  const boundToggleActive = setUserActiveAction.bind(null, id, !target.active);

  return (
    <div className="max-w-lg flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Gebruiker bewerken
        </h1>
        <p className="text-sm text-slate-500">{target.email}</p>
      </div>

      <form action={boundUpdate} className="flex flex-col gap-4 text-sm">
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
            defaultValue={target.email}
            required
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
            Team (enkel voor rol &quot;User&quot;)
          </label>
          <select
            name="teamId"
            defaultValue={target.teamId ?? ""}
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
        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Wijzigingen opslaan
        </button>
      </form>

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
    </div>
  );
}
