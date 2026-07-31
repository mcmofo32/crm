import Link from "next/link";
import { Plus, Search, Download, Users } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import {
  getLeadsForCurrentUser,
  getFunnelStagesForFilter,
  getAssignableUsers,
  type LeadContactFilter,
  type LeadSortOption,
} from "@/lib/actions/leads";
import { canDeleteLeads } from "@/lib/permissions";
import {
  LEAD_TYPE_LABELS,
  LEAD_TYPE_BADGE_VARIANT,
  leadStatusLabel,
  LEAD_STATUS_BADGE_VARIANT,
} from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    q?: string;
    stageId?: string;
    ownerId?: string;
    contact?: string;
    sort?: string;
  }>;
}) {
  const { type, q, stageId, ownerId, contact, sort } = await searchParams;
  const leadType =
    type === "FA" || type === "RG" ? (type as LeadType) : undefined;
  const contactFilter =
    contact === "none" || contact === "overdue"
      ? (contact as LeadContactFilter)
      : undefined;
  const sortBy = sort === "stale" ? ("stale" as LeadSortOption) : undefined;

  const assignableUsers = await getAssignableUsers();
  const requiresSelection = assignableUsers.length > 1;
  const selectedOwnerId =
    ownerId && assignableUsers.some((u) => u.id === ownerId)
      ? ownerId
      : requiresSelection
        ? null
        : (assignableUsers[0]?.id ?? null);

  const viewer = (await getEffectiveViewer())!;
  const canDelete = canDeleteLeads(viewer);

  function tabHref(t: "ALLE" | "FA" | "RG") {
    const params = new URLSearchParams();
    if (t !== "ALLE") params.set("type", t);
    if (q) params.set("q", q);
    if (selectedOwnerId) params.set("ownerId", selectedOwnerId);
    if (stageId) params.set("stageId", stageId);
    if (contact) params.set("contact", contact);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  }

  const ownerSwitcher = requiresSelection && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      {leadType && <input type="hidden" name="type" value={leadType} />}
      {q && <input type="hidden" name="q" value={q} />}
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">Bekijk leads van:</label>
      <select
        name="ownerId"
        defaultValue={selectedOwnerId ?? ""}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="" disabled>
          Kies een medewerker…
        </option>
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
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

  if (!selectedOwnerId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold text-slate-900">Leads</h1>
        {ownerSwitcher}
        <p className="text-base text-slate-500">
          Kies hierboven een medewerker om diens leads te bekijken. Om te
          voorkomen dat leads van verschillende medewerkers door elkaar
          worden getoond, toont deze lijst altijd de leads van precies één
          persoon tegelijk.
        </p>
      </div>
    );
  }

  const [leads, stages] = await Promise.all([
    getLeadsForCurrentUser(leadType, q, {
      stageId: stageId || undefined,
      ownerId: selectedOwnerId,
      contactFilter,
      sortBy,
    }),
    getFunnelStagesForFilter(),
  ]);

  const filtersActive = Boolean(stageId || contactFilter || sortBy);

  const exportParams = new URLSearchParams();
  if (leadType) exportParams.set("type", leadType);
  if (q) exportParams.set("q", q);
  const exportHref = `/api/leads/export${
    exportParams.size > 0 ? `?${exportParams.toString()}` : ""
  }`;

  function clearFiltersHref() {
    const params = new URLSearchParams();
    if (leadType) params.set("type", leadType);
    if (q) params.set("q", q);
    if (selectedOwnerId) params.set("ownerId", selectedOwnerId);
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  }

  const visibleStages = leadType
    ? stages.filter((s) => s.leadType === leadType)
    : stages;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Leads</h1>
        <div className="flex items-center gap-2">
          <Link
            href={exportHref}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download size={17} />
            Exporteren
          </Link>
          <Link
            href="/leads/new"
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Nieuwe lead
          </Link>
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
                Fase
              </label>
              <select
                name="stageId"
                defaultValue={stageId ?? ""}
                className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Alle fases</option>
                {visibleStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {!leadType ? ` (${LEAD_TYPE_LABELS[s.leadType]})` : ""}
                  </option>
                ))}
              </select>

              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Contactstatus
              </label>
              <select
                name="contact"
                defaultValue={contact ?? ""}
                className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Alle</option>
                <option value="none">Zonder contact</option>
                <option value="overdue">Verlopen opvolging</option>
              </select>

              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Sorteren op
              </label>
              <select
                name="sort"
                defaultValue={sort ?? "recent"}
                className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="recent">Meest recent toegevoegd</option>
                <option value="stale">Langst geen contact</option>
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
              <th className="px-6 py-3 font-medium">Fase</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Telefoon</th>
              <th className="px-6 py-3 font-medium">Aanbevolen door</th>
              <th className="px-4 py-3 font-medium">Laatste contact</th>
              <th className="px-4 py-3 font-medium">Volgend contact</th>
              {canDelete && <th className="px-6 py-3 font-medium"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-6 py-4">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {lead.firstName} {lead.lastName}
                  </Link>
                  {lead.company && (
                    <span className="ml-2 text-slate-400">
                      {lead.company}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Badge variant={LEAD_TYPE_BADGE_VARIANT[lead.leadType]}>
                    {LEAD_TYPE_LABELS[lead.leadType]}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-600">{lead.stage.label}</td>
                <td className="px-6 py-4">
                  <Badge variant={LEAD_STATUS_BADGE_VARIANT[lead.status]}>
                    {leadStatusLabel(lead.status, lead.leadType)}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {lead.phone || "—"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {lead.source || "—"}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                  {formatDate(lead.lastContactedAt)}
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                  {lead.activities[0]
                    ? formatDate(lead.activities[0].scheduledAt)
                    : "—"}
                </td>
                {canDelete && (
                  <td className="px-6 py-4 text-right">
                    <DeleteLeadButton
                      leadId={lead.id}
                      leadName={`${lead.firstName} ${lead.lastName}`}
                    />
                  </td>
                )}
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={canDelete ? 9 : 8}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  {filtersActive || q
                    ? "Geen leads gevonden voor deze filters."
                    : "Nog geen leads."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
