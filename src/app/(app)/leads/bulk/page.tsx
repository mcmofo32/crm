import Link from "next/link";
import { Download } from "lucide-react";
import { BulkLeadForm } from "@/components/BulkLeadForm";

export default function BulkNewLeadPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Leads in bulk toevoegen
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Vul de tabel in zoals in Excel — elke rij wordt één lead, en komt
            bij jezelf terecht. Handig om je eigen oude leads te importeren:
            download het sjabloon, vul het in in Excel, selecteer daar alle
            ingevulde rijen (Ctrl+C) en plak ze (Ctrl+V) in de eerste cel
            hieronder — er is geen aparte upload-knop, dit gaat via plakken.
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

      <BulkLeadForm />
    </div>
  );
}
