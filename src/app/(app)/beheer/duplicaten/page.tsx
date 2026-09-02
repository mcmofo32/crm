import { redirect } from "next/navigation";
import Link from "next/link";
import { Copy, X, Trash2 } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getDuplicateLeads, dismissDuplicateGroupAction } from "@/lib/actions/duplicates";
import { deleteLeadAction } from "@/lib/actions/leads";
import type { SimpleDuplicateGroup } from "@/lib/duplicateUtils";

// Nooit cachen/statisch renderen — dit overzicht moet elke keer vers zijn.
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

/** Bewust erg eenvoudig gehouden: platte tekst i.p.v. Badge/Avatar-componenten, geen extra relaties. */
function DuplicateGroupCard({ group }: { group: SimpleDuplicateGroup }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm text-slate-500">
        <span className="font-medium text-slate-700">{group.matchLabel}</span>
        <form action={dismissDuplicateGroupAction.bind(null, group.key)}>
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
      <ul className="divide-y divide-slate-100">
        {group.leads.map((lead, index) => (
          <li
            key={lead.id}
            className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-base"
          >
            <span className="flex items-center gap-2">
              <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:underline">
                {lead.firstName} {lead.lastName}
              </Link>
              {index === 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Eerst toegevoegd
                </span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {lead.ownerName} · {formatDate(lead.createdAt)}
              </span>
              <form action={deleteLeadAction.bind(null, lead.id)}>
                <button
                  type="submit"
                  title="Lead verwijderen (naar prullenbak)"
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                  Verwijderen
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function DuplicatenPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canViewBeheerderTools(viewer)) redirect("/dashboard");

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
          meerdere mensen dezelfde persoon contacteren.
        </p>
      </div>

      {groups.length === 0 ? (
        <p className="text-base text-slate-500">Geen dubbele leads gevonden.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <DuplicateGroupCard key={group.key} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
