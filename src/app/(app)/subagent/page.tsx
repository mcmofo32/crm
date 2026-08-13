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
} from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getSubagents } from "@/lib/actions/subagents";
import {
  setCaseManagerAction,
  setTaxDeclarationStatusAction,
  type CustomerSortOption,
} from "@/lib/actions/leadProducts";
import {
  getManagedCustomers,
  getManagedCustomerStats,
  getManagedScopePersons,
  resolveManagedUserIds,
} from "@/lib/actions/subagentPortal";
import {
  getProductionStructureOptions,
  getCurrentProductionMonthRange,
  getCurrentProductionYearRange,
} from "@/lib/actions/production";
import { canManageCustomerData, canManageUsers } from "@/lib/permissions";
import { PRODUCT_TYPE_LABELS, PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import { MONTH_LABELS } from "@/lib/goalLabels";
import { ProductType } from "@/generated/prisma/client";
import { InlineSelect } from "@/components/InlineSelect";
import { SubagentTabs } from "@/components/SubagentTabs";

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

/** Voorvoegsel om een structuur-optie te onderscheiden van een individuele gebruiker in de scope-select. */
const TEAM_PREFIX = "team:";
/** Sentinelwaarde voor "iedereen" (heel het bedrijf) — enkel voor Beheerder/Admin. */
const ALL_OPTION = "alles";

export default async function SubagentKlantenPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    q?: string;
    product?: string;
    sort?: string;
    followUpMonth?: string;
  }>;
}) {
  const { scope, q, product, sort, followUpMonth } = await searchParams;
  const productType =
    product && (Object.values(ProductType) as string[]).includes(product)
      ? (product as ProductType)
      : undefined;
  const sortBy: CustomerSortOption | undefined =
    sort === "oldest" || sort === "amount" || sort === "units" ? sort : undefined;
  const followUpMonthNum = Number(followUpMonth);
  const followUpMonthValue =
    followUpMonth && followUpMonthNum >= 1 && followUpMonthNum <= 12
      ? followUpMonthNum
      : undefined;

  const viewer = (await getEffectiveViewer())!;
  const canEditCustomerData = canManageCustomerData(viewer);
  const canPickScope = canManageUsers(viewer);

  const [subagents, structureOptions, personOptions, monthPeriod, yearPeriod] =
    await Promise.all([
      getSubagents(),
      canPickScope ? getProductionStructureOptions() : Promise.resolve([]),
      canPickScope ? getManagedScopePersons() : Promise.resolve([]),
      getCurrentProductionMonthRange(),
      getCurrentProductionYearRange(),
    ]);

  const showAll = canPickScope && scope === ALL_OPTION;
  const structureId =
    canPickScope && scope?.startsWith(TEAM_PREFIX)
      ? scope.slice(TEAM_PREFIX.length)
      : undefined;
  const personId =
    canPickScope &&
    scope &&
    scope !== ALL_OPTION &&
    !scope.startsWith(TEAM_PREFIX) &&
    personOptions.some((p) => p.id === scope)
      ? scope
      : undefined;

  const userIds = await resolveManagedUserIds(structureId, personId, showAll);

  const scopeSwitcher = canPickScope && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      {q && <input type="hidden" name="q" value={q} />}
      {product && <input type="hidden" name="product" value={product} />}
      {sort && <input type="hidden" name="sort" value={sort} />}
      {followUpMonth && (
        <input type="hidden" name="followUpMonth" value={followUpMonth} />
      )}
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">
        Bekijk klanten onder beheer van:
      </label>
      <select
        name="scope"
        defaultValue={scope ?? ""}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Mezelf</option>
        <option value={ALL_OPTION}>Iedereen</option>
        {personOptions
          .filter((p) => p.id !== viewer.id)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        {structureOptions.map((s) => (
          <option key={s.id} value={`${TEAM_PREFIX}${s.id}`}>
            Structuur: {s.label}
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
    getManagedCustomers({
      userIds,
      search: q,
      productType,
      sortBy,
      followUpMonth: followUpMonthValue,
    }),
    getManagedCustomerStats(monthPeriod, yearPeriod, userIds),
  ]);

  const monthlyPremiumTotal = customers.reduce((sum, c) => sum + c.totalAmount, 0);
  const taxStatusColors: Record<string, { background: string; color: string }> = {
    TODO: { background: "#fecaca", color: "#991b1b" },
    SCHEDULED: { background: "#fef08a", color: "#854d0e" },
    DONE: { background: "#bbf7d0", color: "#166534" },
    NVT: { background: "#e2e8f0", color: "#475569" },
    BOEKHOUDER: { background: "#e9d5ff", color: "#6b21a8" },
  };
  const taxStatusOptions = [
    { value: "DONE", label: "Opvolging Gedaan", style: taxStatusColors.DONE },
    { value: "TODO", label: "Opvolging nog te doen", style: taxStatusColors.TODO },
    { value: "SCHEDULED", label: "Opvolging Ingepland", style: taxStatusColors.SCHEDULED },
    { value: "NVT", label: "NVT", style: taxStatusColors.NVT },
    { value: "BOEKHOUDER", label: "Boekhouder", style: taxStatusColors.BOEKHOUDER },
  ];
  const taxStatusLabelByValue = new Map(
    taxStatusOptions.map((o) => [o.value, o.label])
  );

  const filtersActive = Boolean(product || sortBy || followUpMonthValue);
  function clearFiltersHref() {
    const params = new URLSearchParams();
    if (scope) params.set("scope", scope);
    if (q) params.set("q", q);
    const qs = params.toString();
    return qs ? `/subagent?${qs}` : "/subagent";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <UserCheck size={20} />
            </span>
            Klanten onder beheer
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Klanten waar jij (of de gekozen structuur/persoon) dossierbeheerder van bent.
          </p>
        </div>
      </div>

      <SubagentTabs active="klanten" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Totaal klanten onder beheer"
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

      {scopeSwitcher}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <form method="GET" className="flex flex-wrap items-center gap-2">
          {scope && <input type="hidden" name="scope" value={scope} />}
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

              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Opvolging — verjaardagsmaand
              </label>
              <select
                name="followUpMonth"
                defaultValue={followUpMonthValue ? String(followUpMonthValue) : ""}
                className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Alle maanden</option>
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i + 1}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mb-3 -mt-2 text-xs text-slate-400">
                Toont enkel klanten die in deze kalendermaand klant geworden
                zijn (elk jaar) — handig voor de jaarlijkse opvolging op hun
                verjaardag.
              </p>

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
              <th className="px-4 py-3 font-medium">Dossierbeheerder</th>
              <th className="px-4 py-3 font-medium">Aanbrenger</th>
              <th className="px-6 py-3 font-medium">Telefoonnummer</th>
              <th className="px-6 py-3 font-medium">E-mailadres</th>
              <th className="px-6 py-3 font-medium">Opvolging</th>
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
                  <td className="px-4 py-4 text-slate-600">
                    {customer.owner.name}
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
                <td colSpan={10} className="px-6 py-8 text-center text-slate-400">
                  {filtersActive || q
                    ? "Geen klanten gevonden voor deze filters."
                    : "Geen klanten onder beheer."}
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
