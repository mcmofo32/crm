import { redirect } from "next/navigation";
import Link from "next/link";
import { Copy, X } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getDuplicateLeads, dismissDuplicateGroupAction } from "@/lib/actions/duplicates";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

export default async function DuplicatenPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

  let groups: Awaited<ReturnType<typeof getDuplicateLeads>> = [];
  let loadError = false;
  try {
    groups = await getDuplicateLeads();
  } catch (err) {
    console.error("[duplicaten-pagina] kon duplicaten niet laden", err);
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Copy size={26} />
          Dubbele leads
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Leads met hetzelfde e-mailadres of telefoonnummer, zodat niet
          meerdere mensen dezelfde persoon contacteren.
        </p>
      </div>

      {loadError ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Kon de duplicaten niet laden. Probeer de pagina te herladen; blijft
          dit gebeuren, meld het aan Robin.
        </p>
      ) : groups.length === 0 ? (
        <p className="text-base text-slate-500">
          Geen dubbele leads gevonden.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div
              key={group.key}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm text-slate-500">
                <div className="flex flex-wrap items-center gap-2">
                  {group.sharedEmails.map((email) => (
                    <Badge key={email} variant="amber">
                      {email}
                    </Badge>
                  ))}
                  {group.sharedPhones.map((phone) => (
                    <Badge key={phone} variant="amber">
                      {phone}
                    </Badge>
                  ))}
                </div>
                <form
                  action={dismissDuplicateGroupAction.bind(
                    null,
                    group.leads.map((l) => l.id)
                  )}
                >
                  <button
                    type="submit"
                    title="Geen probleem, negeer deze groep"
                    className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <X size={14} />
                    Geen probleem
                  </button>
                </form>
              </div>
              <table className="w-full text-base">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-medium">Naam</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Huidige fase</th>
                    <th className="px-6 py-3 font-medium">Eigenaar</th>
                    <th className="px-6 py-3 font-medium">Toegevoegd</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.leads.map((lead, index) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="hover:underline"
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                        {index === 0 && (
                          <Badge variant="green" className="ml-2">
                            Eerst toegevoegd
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={LEAD_TYPE_BADGE_VARIANT[lead.leadType]}>
                          {LEAD_TYPE_LABELS[lead.leadType]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {lead.stageLabel}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={lead.ownerName} />
                          <span className="text-slate-700">
                            {lead.ownerName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {lead.createdByName} ·{" "}
                        {lead.createdAt.toLocaleDateString("nl-BE", {
                          dateStyle: "medium",
                          timeZone: "Europe/Brussels",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
