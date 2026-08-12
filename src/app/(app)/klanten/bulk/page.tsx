import { notFound } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageCustomerData } from "@/lib/permissions";
import { getAssignableUsers } from "@/lib/actions/leads";
import { BulkCustomerImportForm } from "@/components/BulkCustomerImportForm";

export default async function BulkNewCustomerPage() {
  const viewer = (await getEffectiveViewer())!;
  if (!canManageCustomerData(viewer)) notFound();

  const assignableUsers = await getAssignableUsers();

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">
          Klanten in bulk toevoegen
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Download je klantenlijst uit Google Sheets als Excel (.xlsx) en
          upload ze hier — elke rij wordt één klant, meteen met de juiste
          producten. Kies eerst de medewerker: die wordt automatisch
          eigenaar van alle klanten in dit bestand, dus je hoeft ze niet
          één voor één toe te wijzen. Herkende kolommen: Naam (of
          Voornaam/Achternaam apart), Nummer, Email, Datum, en de
          productkolommen (bv. PSP, LTS, BEL, VAPZ, DELA, IPT).
        </p>
      </div>

      <BulkCustomerImportForm
        assignableUsers={assignableUsers}
        defaultOwnerId={viewer.id}
      />
    </div>
  );
}
