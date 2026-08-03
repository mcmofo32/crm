import Link from "next/link";
import { Target, ChevronRight } from "lucide-react";
import { getGoalManagementUsers } from "@/lib/actions/goals";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

export default async function DoelenPage() {
  const users = await getGoalManagementUsers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Target size={24} />
          Doelen
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Stel per gebruiker de wekelijkse doelen en de jaarlijkse KPI&apos;s in
          die op het dashboard getoond worden.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Rol</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <Link
                    href={`/beheer/doelen/${u.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar name={u.name} />
                    {u.name}
                  </Link>
                </td>
                <td className="px-6 py-4">
                  <Badge variant={ROLE_BADGE_VARIANT[u.role]}>
                    {ROLE_LABELS[u.role]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/beheer/doelen/${u.id}`}
                    title="Doelen instellen"
                    className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ChevronRight size={18} />
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
