import Link from "next/link";
import { Plus, MoreVertical } from "lucide-react";
import { getManageableUsers } from "@/lib/actions/users";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

export default async function UsersPage() {
  const users = await getManageableUsers();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Gebruikers</h1>
        <Link
          href="/beheer/gebruikers/new"
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          Nieuwe gebruiker
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">E-mail</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium">Team</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <Link
                    href={`/beheer/gebruikers/${u.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar name={u.name} />
                    {u.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-slate-500">{u.email || "—"}</td>
                <td className="px-6 py-4">
                  <Badge variant={ROLE_BADGE_VARIANT[u.role]}>
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {u.coachedTeam?.name ?? u.team?.name ?? "—"}
                </td>
                <td className="px-6 py-4">
                  <Badge variant={u.active ? "green" : "slate"}>
                    {u.active ? "Actief" : "Inactief"}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/beheer/gebruikers/${u.id}`}
                    title="Instellingen"
                    className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <MoreVertical size={18} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
