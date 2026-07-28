import Link from "next/link";
import { getManageableUsers } from "@/lib/actions/users";
import { ROLE_LABELS } from "@/lib/roleLabels";

export default async function UsersPage() {
  const users = await getManageableUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Gebruikers</h1>
        <Link
          href="/beheer/gebruikers/new"
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Nieuwe gebruiker
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Naam</th>
              <th className="px-4 py-2 font-medium">E-mail</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Team</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium text-slate-900">
                  <Link href={`/beheer/gebruikers/${u.id}`} className="hover:underline">
                    {u.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-500">{u.email}</td>
                <td className="px-4 py-2">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-2 text-slate-500">
                  {u.coachedTeam?.name ?? u.team?.name ?? "—"}
                </td>
                <td className="px-4 py-2">
                  {u.active ? (
                    <span className="text-green-600">Actief</span>
                  ) : (
                    <span className="text-slate-400">Inactief</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
