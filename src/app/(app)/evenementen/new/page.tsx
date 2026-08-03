import { redirect } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageEvents } from "@/lib/permissions";
import { createEventAction } from "@/lib/actions/events";

export default async function NewEventPage() {
  const user = (await getEffectiveViewer())!;
  if (!canManageEvents(user)) redirect("/evenementen");

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900">
        Nieuw evenement
      </h1>
      <form
        action={createEventAction}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Titel</span>
          <input
            type="text"
            name="title"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Type</span>
          <select
            name="type"
            defaultValue="MEETING"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="MEETING">Vergadering</option>
            <option value="SEMINAR">Seminarie</option>
          </select>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Datum</span>
            <input
              type="date"
              name="date"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Uur</span>
            <input
              type="time"
              name="time"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Locatie</span>
          <input
            type="text"
            name="location"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Beschrijving
          </span>
          <textarea
            name="description"
            rows={4}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            Evenement aanmaken
          </button>
        </div>
      </form>
    </div>
  );
}
