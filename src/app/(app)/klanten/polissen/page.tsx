import Link from "next/link";
import { Users, Search, FileText } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getTeamsForCustomerFilter } from "@/lib/actions/leadProducts";
import {
  getPoliciesForCurrentUser,
  setPolicyEmployeeAction,
  setPolicyCompanyAction,
  setPolicyStatusAction,
  setPolicyChecklistFieldAction,
  setPolicyDateAction,
} from "@/lib/actions/policies";
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

/** Voorvoegsel om een team/structuur-optie te onderscheiden van een individuele gebruiker in "Bekijk klanten van". */
const TEAM_PREFIX = "team:";

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

export default async function PolissenPage({
  searchParams,
}: {
  searchParams: Promise<{ ownerId?: string; q?: string }>;
}) {
  const { ownerId, q } = await searchParams;

  const viewer = (await getEffectiveViewer())!;
  const [assignableUsers, teams] = await Promise.all([
    getAssignableUsers(),
    getTeamsForCustomerFilter(),
  ]);

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

  const ownerSwitcher = requiresSelection && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      {q && <input type="hidden" name="q" value={q} />}
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">Bekijk polissen van:</label>
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

  const policies = await getPoliciesForCurrentUser({
    ownerId: selectedOwnerIds ? undefined : selectedOwnerId,
    ownerIds: selectedOwnerIds,
    search: q,
  });

  const totalUnits = policies.reduce((sum, p) => sum + p.units, 0);

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
            Eén lijn per product/contract — komt er automatisch bij zodra een
            klant een product krijgt toegewezen.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <form method="GET" className="flex items-center gap-2">
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
              placeholder="Zoek op klantnaam..."
              className="w-72 rounded-md border border-slate-300 py-2 pl-9 pr-3 text-base"
            />
          </div>
        </form>
      </div>

      {ownerSwitcher}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                  {formatDate(p.createdAt)}
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
            {policies.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-8 text-center text-slate-400">
                  {q ? "Geen polissen gevonden voor deze zoekopdracht." : "Nog geen polissen."}
                </td>
              </tr>
            )}
          </tbody>
          {policies.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-900 bg-slate-900 font-semibold text-white">
                <td className="px-3 py-2.5" colSpan={3}>
                  {policies.length}
                </td>
                <td className="px-3 py-2.5 text-right">{totalUnits}</td>
                <td className="px-3 py-2.5" colSpan={8}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
