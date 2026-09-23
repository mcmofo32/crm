import Link from "next/link";
import { notFound } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageCustomerData } from "@/lib/permissions";
import { getOwnerCandidates } from "@/lib/actions/leads";
import { getSubagents } from "@/lib/actions/subagents";
import { CreateCustomerForm } from "@/components/CreateCustomerForm";

export default async function NewCustomerPage() {
  const viewer = (await getEffectiveViewer())!;
  if (!canManageCustomerData(viewer)) notFound();

  const [ownerCandidates, subagents] = await Promise.all([
    getOwnerCandidates(),
    getSubagents(),
  ]);
  // Is de aanmaker zelf een subagent, dan is hij standaard ook de
  // dossierbeheerder van de klant die hij toevoegt.
  const defaultCaseManagerSubagentId =
    subagents.find((s) => s.userId === viewer.id)?.id ?? "";

  return (
    <div className="max-w-xl">
      <div className="mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Klant toevoegen
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Maakt meteen een klant aan (met producten) i.p.v. eerst als lead
            door de funnel te lopen — handig om bestaande klanten uit een
            oud systeem over te zetten.
          </p>
        </div>
        <Link
          href="/klanten/bulk"
          className="whitespace-nowrap text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          Meerdere in bulk (Excel)
        </Link>
      </div>
      <CreateCustomerForm
        viewerId={viewer.id}
        ownerCandidates={ownerCandidates}
        subagents={subagents}
        defaultCaseManagerSubagentId={defaultCaseManagerSubagentId}
      />
    </div>
  );
}
