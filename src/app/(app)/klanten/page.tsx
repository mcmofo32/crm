import Link from "next/link";
import {
  UserCheck,
  Users,
  Search,
  MoreVertical,
  Users2,
  UserPlus,
  CalendarRange,
  Coins,
  Plus,
} from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getSubagents } from "@/lib/actions/subagents";
import {
  getCustomersForCurrentUser,
  getCustomerStats,
  setCaseManagerAction,
  setTaxDeclarationStatusAction,
  setCustomerOwnerAction,
  getTeamsForCustomerFilter,
  type CustomerSortOption,
} from "@/lib/actions/leadProducts";
import {
  getCurrentProductionMonthRange,
  getCurrentProductionYearRange,
} from "@/lib/actions/production";
import { canManageCustomerData, canManageUsers } from "@/lib/permissions";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import { ProductType } from "@/generated/prisma/client";
import { InlineSelect } from "@/components/InlineSelect";
import { KlantenTabs } from "@/components/KlantenTabs";

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

/** Voorvoegsel om een team/structuur-optie te onderscheiden van een individuele gebruiker in "Bekijk klanten van". */
const TEAM_PREFIX = "team:";

export default async function KlantenPage({
  searchParams,
}: {
  searchParams: Promise<{
    ownerId?: string;
    q?: string;
    product?: string;
    from?: string;
    to?: string;
    sort?: string;
    customerId?: string;
  }>;
}) {
  const { ownerId, q, product, from, to, sort, customerId } = await searchParams;
  const productType =
    product && (Object.values(ProductType) as string[]).includes(product)
      ? (product as ProductType)
      : undefined;
  const sortBy: CustomerSortOption | undefined =
    sort === "oldest" || sort === "amount" || sort === "units" ? sort : undefined;

  const viewer = (await getEffectiveViewer())!;
  const [assignableUsers, teams, subagents, monthPeriod, yearPeriod] =
    await Promise.all([
      getAssignableUsers(),
      getTeamsForCustomerFilter(),
      getSubagents(),
      getCurrentProductionMonthRange(),
      getCurrentProductionYearRange(),
    ]);
  // Enkel Beheerder/Admin mogen klanten van andere mensen bekijken; een
  // Coach ziet hier — anders dan bij leads/pipeline/funnel — altijd enkel
  // zijn eigen klanten, nooit die van zijn medewerkers.
  const canViewOthersCustomers = canManageUsers(viewer);
  const requiresSelection =
    canViewOthersCustomers && (assignableUsers.length > 1 || teams.length > 0);
  const selectedTeam = canViewOthersCustomers
    ? teams.find((t) => `${TEAM_PREFIX}${t.id}` === ownerId)
    : undefined;
  const selectedOwnerId = selectedTeam
    ? `${TEAM_PREFIX}${selectedTeam.id}`
    : canViewOthersCustomers && ownerId && assignableUsers.some((u) => u.id === ownerId)
    ? ownerId
    : viewer.id;
  const selectedOwnerIds = selectedTeam
    ? [selectedTeam.coachId, ...selectedTeam.members.map((m) => m.id)]
    : undefined;

  function clearFiltersHref() {
    const params = new URLSearchParams();
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
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === viewer.id ? `${u.name} (jezelf)` : u.name}
          </option>
        ))}
        {teams.map((t) => (
          <option key={t.id} value={`${TEAM_PREFIX}${t.id}`}>
            Structuur: {t.name}
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

  const [customers, stats] = await Promise.all([
    customerId
      ? getCustomersForCurrentUser({ leadId: customerId })
      : getCustomersForCurrentUser({
          ownerId: selectedOwnerIds ? undefined : selectedOwnerId,
          ownerIds: selectedOwnerIds,
          search: q,
          productType,
          becameCustomerFrom: from ? new Date(`${from}T00:00:00`) : undefined,
          becameCustomerTo: to ? new Date(`${to}T23:59:59.999`) : undefined,
          sortBy,
        }),
    getCustomerStats(monthPeriod, yearPeriod, {
      ownerId: selectedOwnerIds ? undefined : selectedOwnerId,
      ownerIds: selectedOwnerIds,
    }),
  ]);

  const monthlyPremiumTotal = customers.reduce(
    (sum, c) => sum + c.totalAmount,
    0
  );

  const filtersActive = Boolean(product || from || to || sortBy);
  const currentYear = new Date().getFullYear();
  const taxStatusColors: Record<string, { background: string; color: string }> = {
    TODO: { background: "#fed7aa", color: "#9a3412" }, // oranje
    SCHEDULED: { background: "#fef08a", color: "#854d0e" }, // geel
    DONE: { background: "#bbf7d0", color: "#166534" }, // groen
  };
  const taxStatusOptions = [
    { value: "TODO", label: `${currentYear} nog te doen`, style: taxStatusColors.TODO },
    { value: "SCHEDULED", label: `${currentYear} ingepland`, style: taxStatusColors.SCHEDULED },
    { value: "DONE", label: `${currentYear} gedaan`, style: taxStatusColors.DONE },
  ];
  const taxStatusLabelByValue = new Map(
    taxStatusOptions.map((o) => [o.value, o.label])
  );
  // Enkel subagenten (of Beheerder/Admin) mogen klantendata aanpassen; wie
  // enkel eigenaar is ziet zijn klanten wel, maar kan ze niet bewerken tot
  // hij zelf subagent is.
  const canEditCustomerData = canManageCustomerData(viewer);

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
        {canEditCustomerData && (
          <Link
            href="/klanten/new"
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Klant toevoegen
          </Link>
        )}
      </div>

      <KlantenTabs active="klanten" />

      {customerId && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span>Je bekijkt deze ene klant, rechtstreeks vanaf de lead.</span>
          <Link href="/klanten" className="font-medium underline hover:text-blue-900">
            Bekijk alle klanten →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Totaal klanten"
          value={stats.totalCustomers.toLocaleString("nl-BE")}
          icon={Users2}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          label="Nieuwe klanten deze maand"
          value={stats.newThisMonth.toLocaleString("nl-BE")}
          icon={UserPlus}
          color="bg-blue-100 text-blue-700"
          hint={`${formatDate(monthPeriod.startDate)} – ${formatDate(monthPeriod.endDate)}`}
        />
        <StatCard
          label="Nieuwe klanten dit jaar"
          value={stats.newThisYear.toLocaleString("nl-BE")}
          icon={CalendarRange}
          color="bg-purple-100 text-purple-700"
          hint={`${formatDate(yearPeriod.startDate)} – ${formatDate(yearPeriod.endDate)}`}
        />
        <StatCard
          label="Totaal maandelijks incasso"
          value={formatAmount(monthlyPremiumTotal)}
          icon={Coins}
          color="bg-amber-100 text-amber-700"
        />
      </div>

      {ownerSwitcher}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <form method="GET" className="flex flex-wrap items-center gap-2">
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
              <th className="px-6 py-3 font-medium">Klant sinds</th>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Eigenaar</th>
              <th className="px-4 py-3 font-medium">Dossierbeheerder</th>
              <th className="px-6 py-3 font-medium">Telefoonnummer</th>
              <th className="px-6 py-3 font-medium">E-mailadres</th>
              <th className="px-6 py-3 font-medium">Belastingsaangifte</th>
              <th className="px-6 py-3 font-medium text-right">Totale premies</th>
              <th className="px-6 py-3 font-medium text-right">Aantal eenheden</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((customer) => {
              const boundSetCaseManager = setCaseManagerAction.bind(
                null,
                customer.id
              );
              const boundSetTaxStatus = setTaxDeclarationStatusAction.bind(
                null,
                customer.id
              );
              const boundSetOwner = setCustomerOwnerAction.bind(
                null,
                customer.id
              );

              return (
                <tr key={customer.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-600">
                    {formatDate(customer.becameCustomerAt)}
                  </td>
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
                  <td className="px-4 py-4">
                    {canViewOthersCustomers ? (
                      <InlineSelect
                        action={boundSetOwner}
                        name="ownerId"
                        value={customer.ownerId}
                        options={
                          assignableUsers.some((u) => u.id === customer.ownerId)
                            ? assignableUsers.map((u) => ({ value: u.id, label: u.name }))
                            : [
                                { value: customer.ownerId, label: customer.owner.name },
                                ...assignableUsers.map((u) => ({
                                  value: u.id,
                                  label: u.name,
                                })),
                              ]
                        }
                        className="w-36 truncate rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                      />
                    ) : (
                      <span className="text-slate-600">{customer.owner.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {canEditCustomerData ? (
                      <InlineSelect
                        action={boundSetCaseManager}
                        name="subagentId"
                        value={customer.caseManagerSubagentId ?? ""}
                        options={
                          customer.caseManagerSubagentId
                            ? subagents.map((s) => ({ value: s.id, label: s.name }))
                            : [
                                { value: "", label: customer.caseManagerName },
                                // Wie nu al dossierbeheerder is (via caseManagerUser) staat
                                // hierboven al als eerste optie — zijn eigen
                                // subagent-vermelding (indien hij er ook één heeft) mag dan
                                // niet nog eens apart in de lijst staan.
                                ...subagents
                                  .filter((s) => s.userId !== customer.caseManagerUserId)
                                  .map((s) => ({ value: s.id, label: s.name })),
                              ]
                        }
                        className="w-36 truncate rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                      />
                    ) : (
                      <span className="text-slate-600">
                        {customer.caseManagerName}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {customer.phone || "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {customer.email || "—"}
                  </td>
                  <td className="px-6 py-4">
                    {canEditCustomerData ? (
                      <InlineSelect
                        action={boundSetTaxStatus}
                        name="status"
                        value={customer.taxDeclarationStatus ?? "TODO"}
                        options={taxStatusOptions}
                        className="rounded-md border-0 px-2 py-1.5 text-sm font-medium"
                        style={taxStatusColors[customer.taxDeclarationStatus ?? "TODO"]}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium"
                        style={taxStatusColors[customer.taxDeclarationStatus ?? "TODO"]}
                      >
                        {taxStatusLabelByValue.get(
                          customer.taxDeclarationStatus ?? "TODO"
                        )}
                      </span>
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
                  colSpan={10}
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

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Users2;
  color: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
      >
        <Icon size={20} />
      </span>
      <p className="text-base text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
