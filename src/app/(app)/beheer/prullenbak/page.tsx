import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder } from "@/lib/permissions";
import { getDeletedLeads } from "@/lib/actions/leads";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { RestoreLeadButton } from "@/components/RestoreLeadButton";

export default async function PrullenbakPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!isBeheerder(viewer)) redirect("/dashboard");

  const leads = await getDeletedLeads();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Trash2 size={26} />
          Prullenbak
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Verwijderde leads. Enkel zichtbaar voor de Beheerder.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Eigenaar</th>
              <th className="px-6 py-3 font-medium">Verwijderd door</th>
              <th className="px-6 py-3 font-medium">Verwijderd op</th>
              <th className="px-6 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  {lead.firstName} {lead.lastName}
                  {lead.company && (
                    <span className="ml-2 font-normal text-slate-400">
                      {lead.company}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <Badge variant={LEAD_TYPE_BADGE_VARIANT[lead.leadType]}>
                    {LEAD_TYPE_LABELS[lead.leadType]}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Avatar name={lead.owner.name} />
                    <span className="text-slate-700">{lead.owner.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {lead.deletedBy?.name ?? "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                  {lead.deletedAt?.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-6 py-4 text-right">
                  <RestoreLeadButton leadId={lead.id} />
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-slate-400"
                >
                  De prullenbak is leeg.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
