import { notFound } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { LeadsExcelUpdateForm } from "@/components/LeadsExcelUpdateForm";

export default async function LeadsExcelUpdatePage() {
  const viewer = (await getEffectiveViewer())!;
  if (!canManageUsers(viewer)) notFound();

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <h1 className="text-3xl font-semibold text-slate-900">
          Leads bijwerken vanuit Excel
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Upload een Excel-export (bv. vanuit Google Sheets) om bestaande
          leads bij te werken — er worden nooit nieuwe leads aangemaakt, enkel
          bestaande aangepast. Elke rij wordt gematcht op telefoonnummer, dan
          e-mailadres, dan naam (enkel als die uniek is). Heeft de rij een
          datum in de kolom &quot;Datum gekregen&quot; (of &quot;Datum&quot;),
          dan wordt de aanmaakdatum van de lead daarmee overschreven. Is de
          rij rood gemarkeerd, dan wordt de lead op &quot;geen klant&quot;
          gezet. Staat er iets in de Notities-kolom, dan komt dat als
          rapportering op de lead te staan. Herkende kolommen: Naam (of
          Voornaam/Achternaam apart), Nummer, Email, Datum (gekregen),
          Notities.
        </p>
      </div>

      <LeadsExcelUpdateForm />
    </div>
  );
}
