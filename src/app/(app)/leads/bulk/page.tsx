import Link from "next/link";
import { Download } from "lucide-react";
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
            Vul de tabel in zoals in Excel — elke rij wordt één lead. Handig
            om oude leads te importeren: laat iedereen het sjabloon hieronder
            invullen (met naam/type per rij), verzamel alle rijen in één
            bestand en plak ze in één keer in de tabel.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/api/leads/bulk-template"
            className="flex items-center gap-1.5 text-sm text-slate-500 underline hover:text-slate-700"
          >
            <Download size={15} />
            Sjabloon downloaden (.xlsx)
          </a>
          <Link
            href="/leads/new"
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            Eén lead toevoegen
          </Link>
        </div>
      </div>

      <BulkLeadForm assignableUsers={assignableUsers} currentUserId={viewer.id} />
    </div>
  );
}
