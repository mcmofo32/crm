import Link from "next/link";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import { BulkLeadForm } from "@/components/BulkLeadForm";

export default async function BulkNewLeadPage() {
  const viewer = (await getEffectiveViewer())!;
  const assignableUsers = await getAssignableUsers();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Leads in bulk toevoegen
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Vul de tabel in zoals in Excel — elke rij wordt één lead.
          </p>
        </div>
        <Link
          href="/leads/new"
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          Eén lead toevoegen
        </Link>
      </div>

      <BulkLeadForm assignableUsers={assignableUsers} currentUserId={viewer.id} />
    </div>
  );
}
