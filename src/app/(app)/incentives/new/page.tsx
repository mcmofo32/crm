import { redirect } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageIncentives } from "@/lib/permissions";
import { createIncentiveAction } from "@/lib/actions/incentives";

export default async function NewIncentivePage() {
  const user = (await getEffectiveViewer())!;
  if (!canManageIncentives(user)) redirect("/incentives");

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900">
        Nieuw evenement
      </h1>
      <form
        action={createIncentiveAction}
        encType="multipart/form-data"
        className="flex flex-col gap-4 text-sm"
      >
        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">Titel</label>
          <input
            name="title"
            required
            placeholder="bv. Zomerpush FA"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Vereisten om te winnen
          </label>
          <textarea
            name="description"
            required
            rows={4}
            placeholder="bv. Meeste gewonnen leads FA tussen 1 en 31 augustus wint een cadeaubon."
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">
              Ranglijst gebaseerd op
            </label>
            <select
              name="goalType"
              defaultValue="LEADS_WON"
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="LEADS_WON">Gewonnen leads</option>
              <option value="ACTIVITIES_COMPLETED">
                Afgeronde contactmomenten
              </option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">Funnel</label>
            <select
              name="leadType"
              defaultValue=""
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Leads FA + Leads RG</option>
              <option value="FA">Enkel Leads FA</option>
              <option value="RG">Enkel Leads RG</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Richtcijfer (optioneel)
          </label>
          <input
            name="targetValue"
            type="number"
            min={1}
            placeholder="bv. 10"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">Startdatum</label>
            <input
              name="startDate"
              type="date"
              required
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-medium text-slate-700">Einddatum</label>
            <input
              name="endDate"
              type="date"
              required
              className="rounded-md border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-medium text-slate-700">
            Poster (JPEG of PDF, max 8 MB)
          </label>
          <input
            name="poster"
            type="file"
            accept="image/jpeg,application/pdf"
            className="rounded-md border border-slate-300 px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
        >
          Evenement aanmaken
        </button>
      </form>
    </div>
  );
}
