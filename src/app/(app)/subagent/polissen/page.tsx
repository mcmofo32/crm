import Link from "next/link";
import { Users, Search, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import {
  setPolicyEmployeeAction,
  setPolicyCompanyAction,
  setPolicyStatusAction,
  setPolicyChecklistFieldAction,
  setPolicyDateAction,
} from "@/lib/actions/policies";
import {
  getManagedPolicies,
  getManagedScopePersons,
  resolveManagedUserIds,
} from "@/lib/actions/subagentPortal";
import {
  getProductionStructureOptions,
  getAllProductionMonthConfigs,
  getCurrentProductionMonth,
} from "@/lib/actions/production";
import { resolveProductionMonth } from "@/lib/productionMonth";
import { canManageUsers } from "@/lib/permissions";
import { PRODUCT_TYPE_LABELS } from "@/lib/productTypes";
import {
  INSURANCE_COMPANY_LABELS,
  INSURANCE_COMPANY_ORDER,
  POLICY_STATUS_LABELS,
  POLICY_STATUS_ORDER,
  POLICY_STATUS_COLORS,
} from "@/lib/policyLabels";
import { InlineSelect } from "@/components/InlineSelect";
import { InlineCheckbox } from "@/components/InlineCheckbox";
import { InlineTextField } from "@/components/InlineTextField";
import { SubagentTabs } from "@/components/SubagentTabs";

/** Voorvoegsel om een structuur-optie te onderscheiden van een individuele gebruiker in de scope-select. */
const TEAM_PREFIX = "team:";
/** Sentinelwaarde voor "iedereen" (heel het bedrijf) — enkel voor Beheerder/Admin. */
const ALL_OPTION = "alles";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

const STATUS_OPTIONS = POLICY_STATUS_ORDER.map((status) => ({
  value: status,
  label: POLICY_STATUS_LABELS[status],
  style: POLICY_STATUS_COLORS[status],
}));

const COMPANY_OPTIONS = [
  { value: "", label: "—" },
  ...INSURANCE_COMPANY_ORDER.map((c) => ({ value: c, label: INSURANCE_COMPANY_LABELS[c] })),
];

type PolicyRow = Awaited<ReturnType<typeof getManagedPolicies>>[number];

/** Eén polissentabel — herbruikt per productiemaand-groep, zodat er niet één lange lijst met alle polissen door elkaar staat. */
function PolicyTable({
  policies,
  assignableUsers,
}: {
  policies: PolicyRow[];
  assignableUsers: { id: string; name: string }[];
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-900 text-left text-white">
        <tr>
          <th className="px-3 py-2.5 font-medium">Datum</th>
          <th className="px-3 py-2.5 font-medium">Medewerker</th>
          <th className="px-3 py-2.5 font-medium">Klant</th>
          <th className="px-3 py-2.5 text-right font-medium">Eenheden</th>
          <th className="px-3 py-2.5 font-medium">Product</th>
          <th className="px-3 py-2.5 font-medium">Maatschappij</th>
          <th className="px-3 py-2.5 font-medium">Status</th>
          <th className="px-2 py-2.5 text-center font-medium">Easy</th>
          <th className="px-2 py-2.5 text-center font-medium">Tool</th>
          <th className="px-2 py-2.5 text-center font-medium">RL</th>
          <th className="px-3 py-2.5 font-medium">Ingangsdatum</th>
          <th className="px-3 py-2.5 font-medium">Betaald</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {policies.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="whitespace-nowrap px-3 py-2 text-slate-600">
              {formatDate(p.becameCustomerAt)}
            </td>
            <td className="px-3 py-2">
              <InlineSelect
                action={setPolicyEmployeeAction.bind(null, p.id)}
                name="employeeId"
                value={p.employeeId}
                options={assignableUsers.map((u) => ({ value: u.id, label: u.name }))}
                className="w-36 truncate rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
            </td>
            <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
              <Link href={`/leads/${p.leadId}`} className="hover:underline">
                {p.customerFirstName} {p.customerLastName}
              </Link>
            </td>
            <td className="px-3 py-2 text-right text-slate-700">{p.units}</td>
            <td className="whitespace-nowrap px-3 py-2 text-slate-700">
              {PRODUCT_TYPE_LABELS[p.productType]}
            </td>
            <td className="px-3 py-2">
              <InlineSelect
                action={setPolicyCompanyAction.bind(null, p.id)}
                name="company"
                value={p.company ?? ""}
                options={COMPANY_OPTIONS}
                className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              />
            </td>
            <td className="px-3 py-2">
              <InlineSelect
                action={setPolicyStatusAction.bind(null, p.id)}
                name="status"
                value={p.status}
                options={STATUS_OPTIONS}
                className="w-56 rounded-md border-0 px-2 py-1.5 text-sm font-medium"
                style={POLICY_STATUS_COLORS[p.status]}
              />
            </td>
            <td className="px-2 py-2 text-center">
              <InlineCheckbox
                action={setPolicyChecklistFieldAction.bind(null, p.id, "easy")}
                name="easy"
                checked={p.easy}
              />
            </td>
            <td className="px-2 py-2 text-center">
              <InlineCheckbox
                action={setPolicyChecklistFieldAction.bind(null, p.id, "tool")}
                name="tool"
                checked={p.tool}
              />
            </td>
            <td className="px-2 py-2 text-center">
              <InlineCheckbox
                action={setPolicyChecklistFieldAction.bind(null, p.id, "rl")}
                name="rl"
                checked={p.rl}
              />
            </td>
            <td className="px-3 py-2">
              <InlineTextField
                type="date"
                action={setPolicyDateAction.bind(null, p.id, "ingangsdatum")}
                name="ingangsdatum"
                value={toDateInputValue(p.ingangsdatum)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </td>
            <td className="px-3 py-2">
              <InlineTextField
                type="date"
                action={setPolicyDateAction.bind(null, p.id, "betaaldOp")}
                name="betaaldOp"
                value={toDateInputValue(p.betaaldOp)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function SubagentPolissenPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; q?: string; year?: string }>;
}) {
  const { scope, q, year: yearParam } = await searchParams;

  const viewer = (await getEffectiveViewer())!;
  const canPickScope = canManageUsers(viewer);
  const [
    assignableUsers,
    structureOptions,
    personOptions,
    productionMonthConfigs,
    currentProductionMonth,
  ] = await Promise.all([
    getAssignableUsers(),
    canPickScope ? getProductionStructureOptions() : Promise.resolve([]),
    canPickScope ? getManagedScopePersons() : Promise.resolve([]),
    getAllProductionMonthConfigs(),
    getCurrentProductionMonth(),
  ]);
  // "alle" toont elk jaar door elkaar — nodig omdat rechtstreeks toegevoegde
  // klanten (Klant toevoegen/bulk-import) vaak een historische datum
  // (van vóór dit CRM) als "klant sinds" hebben, en dus in een ander jaar
  // dan het huidige productiejaar terechtkomen. Zonder deze optie leek hun
  // polis-lijn dan "verdwenen", terwijl ze gewoon in dat oudere jaar zaten.
  const showAllYears = yearParam === "alle";
  const selectedYear =
    !showAllYears && yearParam ? Number(yearParam) : currentProductionMonth.year;

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
      <input type="hidden" name="year" value={showAllYears ? "alle" : selectedYear} />
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">Bekijk polissen van:</label>
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

  const policies = await getManagedPolicies({ userIds, search: q });

  // Per productiemaand groeperen — anders staan alle polissen door elkaar in
  // één lange lijst. `becameCustomerAt` (zelfde datum als "Klant sinds" op de
  // Klanten-pagina) bepaalt de productiemaand — niet `createdAt`, want dat is
  // enkel wanneer deze polis-lijn zelf in de database ontstond (bv. bij een
  // backfill kregen zo alle bestaande polissen dezelfde, betekenisloze datum).
  const groupsByKey = new Map<
    string,
    { year: number; month: number; policies: typeof policies }
  >();
  for (const p of policies) {
    const { year, month } = resolveProductionMonth(p.becameCustomerAt, productionMonthConfigs);
    const key = `${year}-${month}`;
    const bucket = groupsByKey.get(key);
    if (bucket) bucket.policies.push(p);
    else groupsByKey.set(key, { year, month, policies: [p] });
  }
  // Standaard enkel het gekozen productiejaar tonen — anders groeit deze
  // lijst onbeperkt mee met elk jaar dat de zaak bestaat — maar "Alle
  // jaren" (showAllYears) toont alles door elkaar, nieuwste eerst.
  const groups = Array.from(groupsByKey.values())
    .filter((g) => showAllYears || g.year === selectedYear)
    .sort((a, b) => (a.year !== b.year ? b.year - a.year : b.month - a.month));
  // Binnen elke productiemaand: meest recente polis bovenaan, oudste
  // onderaan — anders staan ze door elkaar (volgorde van `createdAt` van de
  // polis-rij zelf, niet van de eigenlijke contractdatum).
  for (const g of groups) {
    g.policies.sort((a, b) => b.becameCustomerAt.getTime() - a.becameCustomerAt.getTime());
  }
  const yearPolicies = groups.flatMap((g) => g.policies);
  const totalUnits = yearPolicies.reduce((sum, p) => sum + p.units, 0);

  function yearHref(y: number | "alle") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (scope) params.set("scope", scope);
    params.set("year", String(y));
    return `/subagent/polissen?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <FileText size={20} />
            </span>
            Polissen
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Eén lijn per product/contract van klanten onder beheer.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showAllYears ? (
            <Link
              href={yearHref(currentProductionMonth.year)}
              className="text-sm text-slate-500 underline hover:text-slate-700"
            >
              Terug naar jaarweergave
            </Link>
          ) : (
            <>
              <Link
                href={yearHref(selectedYear - 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                title="Vorig jaar"
              >
                <ChevronLeft size={16} />
              </Link>
              <span className="min-w-16 text-center text-base font-medium text-slate-900">
                {selectedYear}
              </span>
              <Link
                href={yearHref(selectedYear + 1)}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50"
                title="Volgend jaar"
              >
                <ChevronRight size={16} />
              </Link>
            </>
          )}
          <Link
            href={yearHref("alle")}
            title="Alle jaren tonen — handig om ook oudere/historische klanten (bv. rechtstreeks toegevoegd met een datum van vóór dit CRM) terug te vinden"
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              showAllYears
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Alle jaren
          </Link>
        </div>
      </div>

      <SubagentTabs active="polissen" />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <form method="GET" className="flex items-center gap-2">
          {scope && <input type="hidden" name="scope" value={scope} />}
          <input type="hidden" name="year" value={showAllYears ? "alle" : selectedYear} />
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Zoek op klantnaam..."
              className="w-72 rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base"
            />
          </div>
        </form>
      </div>

      {scopeSwitcher}

      {groups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-8 text-center text-slate-400">
          {q
            ? "Geen polissen gevonden voor deze zoekopdracht."
            : showAllYears
            ? "Nog geen polissen van klanten onder beheer."
            : `Geen polissen van klanten onder beheer in ${selectedYear}.`}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, index) => {
            const groupUnits = group.policies.reduce((sum, p) => sum + p.units, 0);
            return (
              <details
                key={`${group.year}-${group.month}`}
                open={index === 0}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-200">
                  <span>
                    Productiemaand {String(group.month).padStart(2, "0")}
                    {showAllYears ? `/${group.year}` : ""}
                  </span>
                  <span className="font-normal text-slate-500">
                    {group.policies.length} polissen · {groupUnits} eenheden
                  </span>
                </summary>
                <div className="overflow-x-auto">
                  <PolicyTable policies={group.policies} assignableUsers={assignableUsers} />
                </div>
              </details>
            );
          })}
        </div>
      )}

      {yearPolicies.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border-2 border-slate-900 bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
          <span>
            Totaal {showAllYears ? "alle jaren" : selectedYear}:{" "}
            {yearPolicies.length} polissen
          </span>
          <span>{totalUnits} eenheden</span>
        </div>
      )}
    </div>
  );
}
