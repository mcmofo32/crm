import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { getLeadsForCurrentUser } from "@/lib/actions/leads";
import { canDeleteLeads } from "@/lib/permissions";
import {
  LEAD_TYPE_LABELS,
  LEAD_TYPE_BADGE_VARIANT,
  leadStatusLabel,
  LEAD_STATUS_BADGE_VARIANT,
} from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const leadType =
    type === "FA" || type === "RG" ? (type as LeadType) : undefined;
  const leads = await getLeadsForCurrentUser(leadType);
  const session = await auth();
  const canDelete = canDeleteLeads(session!.user);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Leads</h1>
        <Link
          href="/leads/new"
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          Nieuwe lead
        </Link>
      </div>

      <div className="flex gap-2 text-base">
        {(["ALLE", "FA", "RG"] as const).map((t) => (
          <Link
            key={t}
            href={t === "ALLE" ? "/leads" : `/leads?type=${t}`}
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
              <th className="px-6 py-3 font-medium">Fase</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Eigenaar</th>
              <th className="px-6 py-3 font-medium">Laatste contact</th>
              <th className="px-6 py-3 font-medium">Volgend contact</th>
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
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={lead.owner.name} />
                    <span className="text-slate-700">{lead.owner.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                  {formatDate(lead.lastContactedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-600">
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
                  colSpan={canDelete ? 8 : 7}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  Nog geen leads.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
