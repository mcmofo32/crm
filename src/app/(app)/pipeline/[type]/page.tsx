import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Voicemail, PhoneCall, Megaphone, Search, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  getPipelineStats,
  getPipelineLeads,
  setLeadQualityScoreAction,
  setLeadInformedAction,
  setLeadCharacteristicsAction,
} from "@/lib/actions/pipeline";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageCustomerData } from "@/lib/permissions";
import { Role } from "@/generated/prisma/client";
import { getSubagents } from "@/lib/actions/subagents";
import { ensureFunnelStages, funnelStageKeys } from "@/lib/funnelStages";
import { InlineSelect } from "@/components/InlineSelect";
import { InlineCheckbox } from "@/components/InlineCheckbox";
import { InlineTextField } from "@/components/InlineTextField";
import { StageSelect } from "@/components/StageSelect";
import { QuickCallLogButton } from "@/components/QuickCallLogButton";

const TYPE_MAP = { verkoop: "FA", recrutering: "RG" } as const;
const TITLES = { verkoop: "Pipeline verkoop", recrutering: "Pipeline Rekrutering" } as const;

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

const SCORE_OPTIONS = Array.from({ length: 11 }, (_, i) => ({
  value: String(i),
  label: String(i),
}));

export default async function PipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ q?: string; ownerId?: string }>;
}) {
  const { type } = await params;
  if (type !== "verkoop" && type !== "recrutering") notFound();
  const { q, ownerId } = await searchParams;

  const leadType = TYPE_MAP[type];
  const isRecrutering = type === "recrutering";

  const user = (await getEffectiveViewer())!;
  await ensureFunnelStages(leadType);
  const [assignableUsers, subagents] = await Promise.all([
    getAssignableUsers(),
    getSubagents(),
  ]);
  // Beheerder/Admin zien anders iedereens leads door elkaar, en een Coach
  // moet net als bij de Funnel per teamlid kunnen wisselen — dus altijd de
  // balk tonen zodra er meer dan enkel jezelf te kiezen valt.
  const requiresSelection =
    assignableUsers.length > 1 || user.role === Role.COACH;
  const selectedOwnerId =
    ownerId && assignableUsers.some((u) => u.id === ownerId)
      ? ownerId
      : user.id;

  const ownerSwitcher = requiresSelection && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">Bekijk pipeline van:</label>
      <select
        name="ownerId"
        defaultValue={selectedOwnerId}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === user.id ? `${u.name} (jezelf)` : u.name}
          </option>
        ))}
      </select>
      {q && <input type="hidden" name="q" value={q} />}
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Bekijken
      </button>
    </form>
  );

  const [stats, leads, stages] = await Promise.all([
    getPipelineStats(leadType, selectedOwnerId),
    getPipelineLeads(leadType, selectedOwnerId, q),
    prisma.funnelStage.findMany({
      where: { leadType, key: { in: funnelStageKeys(leadType) } },
      orderBy: { order: "asc" },
      select: { id: true, label: true, isWon: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Phone size={20} />
            </span>
            {TITLES[type]}
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Eerste contactopvolging vóór een afspraak wordt ingepland.
          </p>
        </div>
        <Link
          href={`/leads/new?type=${leadType}`}
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          Nieuwe lead
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-base text-blue-800">
        <Megaphone size={20} className="flex-shrink-0" />
        <span>
          <strong>{stats.openReferrals}</strong> openstaande aanbevelingen —
          leads met een bron waarmee nog geen contact is geweest.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard
          label="Te contacteren"
          value={stats.teContacteren}
          icon={Phone}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          label="Voicemail"
          value={stats.voicemail}
          icon={Voicemail}
          color="bg-amber-100 text-amber-700"
        />
        <StatCard
          label="Terugkoppelen"
          value={stats.terugkoppelen}
          icon={PhoneCall}
          color="bg-blue-100 text-blue-700"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form method="GET" className="flex items-center gap-2">
          {requiresSelection && (
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
        </form>

        {ownerSwitcher}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Datum</th>
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Nummer</th>
              <th className="px-4 py-3 font-medium">Aanbevolen door</th>
              {isRecrutering ? (
                <th className="px-4 py-3 font-medium">Kenmerken</th>
              ) : (
                <>
                  <th className="px-4 py-3 text-center font-medium">Op de hoogte</th>
                  <th className="px-4 py-3 font-medium">Cijfer op 10</th>
                  <th className="px-4 py-3 font-medium">Laatste contact</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-center font-medium">Aantal keer gebeld</th>
                </>
              )}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                  {formatDate(lead.createdAt)}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">
                  <Link href={`/leads/${lead.id}`} className="hover:underline">
                    {lead.firstName} {lead.lastName}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-600">{lead.phone || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{lead.source || "—"}</td>
                {isRecrutering ? (
                  <td className="px-4 py-2.5">
                    <InlineTextField
                      action={setLeadCharacteristicsAction.bind(null, lead.id)}
                      name="characteristics"
                      value={lead.characteristics ?? ""}
                      placeholder="Vrij in te vullen…"
                    />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2.5 text-center">
                      <InlineCheckbox
                        action={setLeadInformedAction.bind(null, lead.id)}
                        name="isInformed"
                        checked={lead.isInformed}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <InlineSelect
                        action={setLeadQualityScoreAction.bind(null, lead.id)}
                        name="qualityScore"
                        value={lead.qualityScore != null ? String(lead.qualityScore) : ""}
                        options={[{ value: "", label: "—" }, ...SCORE_OPTIONS]}
                        className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDate(lead.lastContactedAt)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{lead.statusLabel}</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">
                      {lead.callCount}
                    </td>
                  </>
                )}
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <QuickCallLogButton leadId={lead.id} />
                    <StageSelect
                      leadId={lead.id}
                      currentStageId={lead.stageId}
                      leadEmail={lead.email}
                      stages={stages}
                      subagents={subagents}
                      canCloseDeals={canManageCustomerData(user)}
                      variant="icon"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={isRecrutering ? 6 : 10}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  {q ? "Geen leads gevonden voor deze zoekopdracht." : "Nog geen leads."}
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
}: {
  label: string;
  value: number;
  icon: typeof Phone;
  color: string;
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
    </div>
  );
}
