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
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          <Building2 size={24} />
          Kantoor
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Het kantooradres wordt automatisch voorgesteld zodra iemand een
          fysieke afspraak inplant en zelf geen adres invult. De notitie
          wordt bij elke fysieke afspraak op dat adres mee in de omschrijving
          gezet (bv. parkeer- of bereikbaarheidsinfo).
        </p>
      </div>

      <form
        action={updateOfficeSettingsAction}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <FormToast message="Kantoorinstellingen opgeslagen" />
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-900 dark:text-slate-100">Kantooradres</label>
          <OfficeAddressField defaultValue={settings?.address ?? ""} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-900 dark:text-slate-100">
            Notitie bij fysieke afspraken
          </label>
          <textarea
            name="note"
            defaultValue={settings?.note ?? ""}
            rows={4}
            placeholder="Bv. Meld je aan bij het onthaal en zeg dat je een afspraak hebt met {naam}."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Gebruik <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{naam}"}</code>{" "}
            en/of{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{telefoon}"}</code>{" "}
            ergens in de tekst om automatisch de juiste naam/nummer in te
            vullen: de aanbrenger/eigenaar bij een Financiële analyse, de
            subagent bij een Adviesgesprek, en anders de toegewezen
            medewerker.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-900 dark:text-slate-100">
            Kantooruren
          </label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              name="workHoursStart"
              defaultValue={settings?.workHoursStart ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <span className="text-slate-400 dark:text-slate-500">tot</span>
            <input
              type="time"
              name="workHoursEnd"
              defaultValue={settings?.workHoursEnd ?? ""}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Buiten dit venster wordt hieronder de notitie voor buiten de
            kantooruren gebruikt in plaats van de notitie hierboven. Beide
            leeg laten = altijd de notitie hierboven gebruiken.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-900 dark:text-slate-100">
            Notitie bij fysieke afspraken buiten de kantooruren
          </label>
          <textarea
            name="afterHoursNote"
            defaultValue={settings?.afterHoursNote ?? ""}
            rows={4}
            placeholder="Bv. Bel {naam} op {telefoon} bij aankomst, het onthaal is dan niet bemand."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Zelfde <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{naam}"}</code>/
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{telefoon}"}</code>
            {" "}als hierboven. Leeg = ook buiten de kantooruren gewoon de
            notitie hierboven gebruiken.
          </p>
        </div>

        <button
          type="submit"
          className="w-fit rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Opslaan
        </button>
      </form>
    </div>
  );
}
