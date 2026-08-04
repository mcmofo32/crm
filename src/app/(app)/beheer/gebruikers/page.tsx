import Link from "next/link";
import { Plus, MoreVertical, Eye, EyeOff, TriangleAlert } from "lucide-react";
import { getManageableUsers } from "@/lib/actions/users";
import { ROLE_LABELS, ROLE_BADGE_VARIANT } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

function normalizedName(name: string) {
  return name.trim().toLowerCase();
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ inactief?: string }>;
}) {
  const { inactief } = await searchParams;
  const showInactive = inactief === "1";

  const allUsers = await getManageableUsers();
  const inactiveCount = allUsers.filter((u) => !u.active).length;
  const users = showInactive ? allUsers : allUsers.filter((u) => u.active);

  // Meerdere accounts met exact dezelfde naam duiden meestal op een
  // (per ongeluk) dubbel aangemaakte gebruiker — bv. via "Nieuwe gebruiker
  // toevoegen" die meermaals gebruikt werd. Dat kan verwarrend/onzichtbaar
  // blijven (elders in de app, zoals het organigram, wordt maar één account
  // getoond), dus flaggen we dit hier expliciet.
  const nameCounts = new Map<string, number>();
  for (const u of allUsers) {
    const key = normalizedName(u.name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const duplicateNameCount = [...nameCounts.values()].filter((c) => c > 1).length;

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

      {inactiveCount > 0 && (
        <Link
          href={showInactive ? "/beheer/gebruikers" : "/beheer/gebruikers?inactief=1"}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {showInactive ? <EyeOff size={15} /> : <Eye size={15} />}
          {showInactive
            ? "Verberg inactieve gebruikers"
            : `Toon ${inactiveCount} inactieve gebruiker${inactiveCount === 1 ? "" : "s"}`}
        </Link>
      )}

      {duplicateNameCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <TriangleAlert size={16} className="flex-shrink-0" />
          {duplicateNameCount === 1
            ? "Er zijn 2 of meer accounts met exact dezelfde naam (zie ⚠ hieronder) — vermoedelijk per ongeluk dubbel aangemaakt."
            : `Er zijn ${duplicateNameCount} namen die bij meerdere accounts voorkomen (zie ⚠ hieronder) — vermoedelijk per ongeluk dubbel aangemaakt.`}
          {" "}Vink "Toon inactieve gebruikers" aan om ze allemaal te zien.
        </div>
      )}

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
            {users.map((u) => {
              const isDuplicateName = (nameCounts.get(normalizedName(u.name)) ?? 0) > 1;
              return (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <Link
                    href={`/beheer/gebruikers/${u.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar name={u.name} />
                    {u.name}
                    {isDuplicateName && (
                      <span
                        title="Nog een account met exact dezelfde naam"
                        className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                      >
                        <TriangleAlert size={12} />
                        Dubbel?
                      </span>
                    )}
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
