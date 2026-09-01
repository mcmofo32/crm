import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageSettings } from "@/lib/permissions";
import { getOfficeSettings, updateOfficeSettingsAction } from "@/lib/actions/officeSettings";
import { OfficeAddressField } from "@/components/OfficeAddressField";
import { FormToast } from "@/components/toast/FormToast";

export default async function KantoorPage() {
  const viewer = await getEffectiveViewer();
  if (!viewer) redirect("/login");
  if (!canManageSettings(viewer)) redirect("/dashboard");

  const settings = await getOfficeSettings();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
          <Building2 size={24} />
          Kantoor
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Het kantooradres wordt automatisch voorgesteld zodra iemand een
          fysieke afspraak inplant en zelf geen adres invult. De notitie
          wordt bij elke fysieke afspraak op dat adres mee in de omschrijving
          gezet (bv. parkeer- of bereikbaarheidsinfo).
        </p>
      </div>

      <form
        action={updateOfficeSettingsAction}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm"
      >
        <FormToast message="Kantoorinstellingen opgeslagen" />
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-900">Kantooradres</label>
          <OfficeAddressField defaultValue={settings?.address ?? ""} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-900">
            Notitie bij fysieke afspraken
          </label>
          <textarea
            name="note"
            defaultValue={settings?.note ?? ""}
            rows={4}
            placeholder="Bv. Meld je aan bij het onthaal en zeg dat je een afspraak hebt met {naam}."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-400">
            Gebruik <code className="rounded bg-slate-100 px-1">{"{naam}"}</code>{" "}
            ergens in de tekst om automatisch de juiste naam in te vullen: de
            aanbrenger/eigenaar bij een Financiële analyse, de subagent bij
            een Adviesgesprek, en anders de toegewezen medewerker.
          </p>
        </div>

        <button
          type="submit"
          className="w-fit rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Opslaan
        </button>
      </form>
    </div>
  );
}
