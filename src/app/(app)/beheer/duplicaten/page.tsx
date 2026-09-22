import { redirect } from "next/navigation";
import Link from "next/link";
import { Copy, X, Trash2 } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getDuplicateLeads, dismissDuplicateGroupAction } from "@/lib/actions/duplicates";
import { deleteLeadAction } from "@/lib/actions/leads";
import { BulkDuplicateCleanupButton } from "@/components/BulkDuplicateCleanupButton";
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
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-300">{group.matchLabel}</span>
        <form action={dismissDuplicateGroupAction.bind(null, group.key)}>
          <button
            type="submit"
            title="Geen probleem, negeer deze groep"
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X size={14} />
            Geen probleem
          </button>
        </form>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {group.leads.map((lead, index) => (
          <li
            key={lead.id}
            className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-base"
          >
            <span className="flex items-center gap-2">
              <Link href={`/leads/${lead.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                {lead.firstName} {lead.lastName}
              </Link>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  lead.isWon
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                    : lead.isLost
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {lead.stageLabel}
              </span>
              {index === 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
                  Eerst toegevoegd
                </span>
              )}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {lead.ownerName} · {formatDate(lead.createdAt)}
              </span>
              <form action={deleteLeadAction.bind(null, lead.id)}>
                <button
                  type="submit"
                  title="Lead verwijderen (naar prullenbak)"
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            <Copy size={26} />
            Dubbele leads
          </h1>
          <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
            Leads met hetzelfde e-mailadres of telefoonnummer, zodat niet
            meerdere mensen dezelfde persoon contacteren.
          </p>
        </div>
        {groups.length > 0 && <BulkDuplicateCleanupButton />}
      </div>

      {groups.length === 0 ? (
        <p className="text-base text-slate-500 dark:text-slate-400">Geen dubbele leads gevonden.</p>
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
