import Link from "next/link";
import { UserCheck, Users } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getCustomersForCurrentUser } from "@/lib/actions/leadProducts";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import { LeadType, Role } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

function formatAmount(amount: number) {
  return amount.toLocaleString("nl-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

export default async function KlantenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; ownerId?: string }>;
}) {
  const { type, ownerId } = await searchParams;
  const leadType = type === "FA" || type === "RG" ? (type as LeadType) : undefined;

  const viewer = (await getEffectiveViewer())!;
  const assignableUsers = await getAssignableUsers();
  const isCoach = viewer.role === Role.COACH;
  const TEAM_OPTION = "team";
  const requiresSelection = assignableUsers.length > 1 || isCoach;
  const selectedOwnerId =
    isCoach && ownerId === TEAM_OPTION
      ? TEAM_OPTION
      : ownerId && assignableUsers.some((u) => u.id === ownerId)
      ? ownerId
      : viewer.id;
  const isTeamView = selectedOwnerId === TEAM_OPTION;

  function tabHref(t: "ALLE" | "FA" | "RG") {
    const params = new URLSearchParams();
    if (t !== "ALLE") params.set("type", t);
    if (selectedOwnerId) params.set("ownerId", selectedOwnerId);
    const qs = params.toString();
    return qs ? `/klanten?${qs}` : "/klanten";
  }

  const ownerSwitcher = requiresSelection && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      {leadType && <input type="hidden" name="type" value={leadType} />}
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">Bekijk klanten van:</label>
      <select
        name="ownerId"
        defaultValue={selectedOwnerId}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {isCoach && <option value={TEAM_OPTION}>Heel mijn team</option>}
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === viewer.id ? `${u.name} (jezelf)` : u.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Bekijken
      </button>
    </form>
  );

  const customers = await getCustomersForCurrentUser({
    leadType,
    ownerId: isTeamView ? undefined : selectedOwnerId,
    ownerIds: isTeamView ? assignableUsers.map((u) => u.id) : undefined,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <UserCheck size={20} />
            </span>
            Klanten
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Overzicht van alle klanten en de producten die ze genomen hebben.
          </p>
        </div>
      </div>

      {ownerSwitcher}

      <div className="flex gap-2 text-base">
        {(["ALLE", "FA", "RG"] as const).map((t) => (
          <Link
            key={t}
            href={tabHref(t)}
            className={`rounded-full px-4 py-1.5 ${
              (t === "ALLE" && !leadType) || t === leadType
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {t === "ALLE" ? "Alle" : LEAD_TYPE_LABELS[t]}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Type</th>
              {isTeamView && (
                <th className="px-6 py-3 font-medium">Eigenaar</th>
              )}
              <th className="px-6 py-3 font-medium">Klant sinds</th>
              <th className="px-6 py-3 font-medium">Producten</th>
              <th className="px-6 py-3 font-medium text-right">Totaal bedrag</th>
              <th className="px-6 py-3 font-medium text-right">Totaal eenheden</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const sortedProducts = [...customer.products].sort(
                (a, b) =>
                  PRODUCT_TYPE_ORDER.indexOf(a.type) - PRODUCT_TYPE_ORDER.indexOf(b.type)
              );
              const totalAmount = sortedProducts.reduce(
                (sum, p) => sum + Number(p.amount),
                0
              );
              const totalUnits = sortedProducts.reduce((sum, p) => sum + p.units, 0);
              const becameCustomerAt = customer.stageChanges[0]?.changedAt ?? null;

              return (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link
                      href={`/leads/${customer.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {customer.firstName} {customer.lastName}
                    </Link>
                    {customer.company && (
                      <span className="ml-2 text-slate-400">{customer.company}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={LEAD_TYPE_BADGE_VARIANT[customer.leadType]}>
                      {LEAD_TYPE_LABELS[customer.leadType]}
                    </Badge>
                  </td>
                  {isTeamView && (
                    <td className="px-6 py-4 text-slate-600">{customer.owner.name}</td>
                  )}
                  <td className="px-6 py-4 text-slate-600">
                    {formatDate(becameCustomerAt)}
                  </td>
                  <td className="px-6 py-4">
                    {sortedProducts.length === 0 ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {sortedProducts.map((p) => (
                          <span
                            key={p.type}
                            title={`${formatAmount(Number(p.amount))} · ${p.units} eenh.`}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                          >
                            {PRODUCT_TYPE_LABELS[p.type]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">
                    {formatAmount(totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{totalUnits}</td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={isTeamView ? 7 : 6} className="px-6 py-8 text-center text-slate-400">
                  Nog geen klanten.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
