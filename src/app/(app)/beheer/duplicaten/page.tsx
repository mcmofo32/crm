import { redirect } from "next/navigation";
import Link from "next/link";
import { Copy } from "lucide-react";
import { auth } from "@/lib/auth";
import { isBeheerder } from "@/lib/permissions";
import { getDuplicateLeads } from "@/lib/actions/duplicates";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

export default async function DuplicatenPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isBeheerder(session.user)) redirect("/dashboard");

  const groups = await getDuplicateLeads();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Copy size={26} />
          Dubbele leads
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Leads met hetzelfde e-mailadres of telefoonnummer, zodat niet
          meerdere mensen dezelfde persoon contacteren. Enkel zichtbaar voor
          de Beheerder.
        </p>
      </div>

      {groups.length === 0 ? (
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
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm text-slate-500">
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
