import { notFound } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageCustomerData } from "@/lib/permissions";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getSubagents } from "@/lib/actions/subagents";
import { BulkCustomerImportForm } from "@/components/BulkCustomerImportForm";

export default async function BulkNewCustomerPage() {
  const viewer = (await getEffectiveViewer())!;
  if (!canManageCustomerData(viewer)) notFound();

  const [assignableUsers, subagents] = await Promise.all([
    getAssignableUsers(),
    getSubagents(),
  ]);
  // Is de importeur zelf een subagent, dan is hij standaard ook de
  // dossierbeheerder van wat hij importeert — zie BulkCustomerImportForm.
  const defaultCaseManagerSubagentId =
    subagents.find((s) => s.userId === viewer.id)?.id ?? "";

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">
          Klanten in bulk toevoegen
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Download je klantenlijst uit Google Sheets als Excel (.xlsx) en
          upload ze hier — elke rij wordt één klant, meteen met de juiste
          producten. Heeft je bestand per medewerker een apart tabblad, dan
          hoef je maar één keer te uploaden: de tabbladnaam wordt vergeleken
          met de namen van je medewerkers, en elke klant op dat tabblad
          krijgt automatisch die medewerker als eigenaar. Heeft het bestand
          maar één tabblad, dan geldt gewoon de medewerker die je hieronder
          kiest. Herkende kolommen: Naam (of Voornaam/Achternaam apart),
          Nummer, Email, Datum, en de productkolommen (bv. PSP, LTS, BEL,
          NZP, UZP, VAPZ, IPT).
        </p>
      </div>

      <BulkCustomerImportForm
        assignableUsers={assignableUsers}
        defaultOwnerId={viewer.id}
        subagents={subagents}
        defaultCaseManagerSubagentId={defaultCaseManagerSubagentId}
      />
    </div>
  );
}
