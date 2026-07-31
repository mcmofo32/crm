import Link from "next/link";
import { UserCheck, Users, Search, MoreVertical } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import {
  getCustomersForCurrentUser,
  type CustomerSortOption,
} from "@/lib/actions/leadProducts";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import { LeadType, ProductType, Role } from "@/generated/prisma/client";
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

const TEAM_OPTION = "team";

export default async function KlantenPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    ownerId?: string;
    q?: string;
    product?: string;
    from?: string;
    to?: string;
    sort?: string;
  }>;
}) {
  const { type, ownerId, q, product, from, to, sort } = await searchParams;
  const leadType = type === "FA" || type === "RG" ? (type as LeadType) : undefined;
  const productType =
    product && (Object.values(ProductType) as string[]).includes(product)
      ? (product as ProductType)
      : undefined;
  const sortBy: CustomerSortOption | undefined =
    sort === "oldest" || sort === "amount" || sort === "units" ? sort : undefined;

  const viewer = (await getEffectiveViewer())!;
  const assignableUsers = await getAssignableUsers();
  const isCoach = viewer.role === Role.COACH;
  const requiresSelection = assignableUsers.length > 1 || isCoach;
  const selectedOwnerId =
    ownerId && (ownerId === TEAM_OPTION ? isCoach : assignableUsers.some((u) => u.id === ownerId))
      ? ownerId
      : isCoach
      ? TEAM_OPTION
      : viewer.id;
  const isTeamView = selectedOwnerId === TEAM_OPTION;

  function tabHref(t: "ALLE" | "FA" | "RG") {
    const params = new URLSearchParams();
    if (t !== "ALLE") params.set("type", t);
    if (selectedOwnerId) params.set("ownerId", selectedOwnerId);
    if (q) params.set("q", q);
    if (product) params.set("product", product);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/klanten?${qs}` : "/klanten";
  }

  function clearFiltersHref() {
    const params = new URLSearchParams();
    if (leadType) params.set("type", leadType);
    if (selectedOwnerId) params.set("ownerId", selectedOwnerId);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/klanten?${qs}` : "/klanten";
  }

  const ownerSwitcher = requiresSelection && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      {leadType && <input type="hidden" name="type" value={leadType} />}
      {q && <input type="hidden" name="q" value={q} />}
      {product && <input type="hidden" name="product" value={product} />}
      {from && <input type="hidden" name="from" value={from} />}
      {to && <input type="hidden" name="to" value={to} />}
      {sort && <input type="hidden" name="sort" value={sort} />}
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
    search: q,
    productType,
    becameCustomerFrom: from ? new Date(`${from}T00:00:00`) : undefined,
    becameCustomerTo: to ? new Date(`${to}T23:59:59.999`) : undefined,
    sortBy,
  });

  const filtersActive = Boolean(product || from || to || sortBy);

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

      <div className="flex flex-wrap items-center justify-between gap-3">
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

        <form method="GET" className="flex flex-wrap items-center gap-2">
          {leadType && <input type="hidden" name="type" value={leadType} />}
          {selectedOwnerId && (
            <input type="hidden" name="ownerId" value={selectedOwnerId} />
          )}
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Zoek op naam, e-mail, telefoon of bedrijf..."
              className="w-72 rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base"
            />
          </div>

          <details className="relative">
            <summary
              className={`flex cursor-pointer list-none items-center gap-1.5 rounded-md border px-4 py-2 text-base font-medium ${
                filtersActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Filter
              {filtersActive && (
                <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900">
                  •
                </span>
              )}
            </summary>
            <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Product
              </label>
              <select
                name="product"
                defaultValue={product ?? ""}
                className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Alle producten</option>
                {PRODUCT_TYPE_ORDER.map((pt) => (
                  <option key={pt} value={pt}>
                    {PRODUCT_TYPE_LABELS[pt]}
                  </option>
                ))}
              </select>

              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Klant sinds
              </label>
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="date"
                  name="from"
                  defaultValue={from ?? ""}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="text-slate-400">t/m</span>
                <input
                  type="date"
                  name="to"
                  defaultValue={to ?? ""}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Sorteren op
              </label>
              <select
                name="sort"
                defaultValue={sort ?? "recent"}
                className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="recent">Meest recent klant</option>
                <option value="oldest">Langst klant</option>
                <option value="amount">Hoogste totaalbedrag</option>
                <option value="units">Meeste eenheden</option>
              </select>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Filters toepassen
                </button>
                {filtersActive && (
                  <Link
                    href={clearFiltersHref()}
                    className="text-sm text-slate-500 underline hover:text-slate-700"
                  >
                    Filters wissen
                  </Link>
                )}
              </div>
            </div>
          </details>
        </form>
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
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const sortedProducts = [...customer.products].sort(
                (a, b) =>
                  PRODUCT_TYPE_ORDER.indexOf(a.type) - PRODUCT_TYPE_ORDER.indexOf(b.type)
              );

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
                    {formatDate(customer.becameCustomerAt)}
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
                    {formatAmount(customer.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {customer.totalUnits}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/leads/${customer.id}`}
                      title="Wijzigingen doorvoeren"
                      className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <MoreVertical size={18} />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td
                  colSpan={isTeamView ? 8 : 7}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  {filtersActive || q
                    ? "Geen klanten gevonden voor deze filters."
                    : "Nog geen klanten."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
