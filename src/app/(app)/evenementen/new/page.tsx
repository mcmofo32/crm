import { redirect } from "next/navigation";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageEvents } from "@/lib/permissions";
import { createEventAction, getEventInviteOptions } from "@/lib/actions/events";
import { EVENT_TYPE_LABELS } from "@/lib/eventTypes";
import { EventInviteField } from "@/components/EventInviteField";

export default async function NewEventPage() {
  const user = (await getEffectiveViewer())!;
  if (!canManageEvents(user)) redirect("/evenementen");

  const inviteOptions = await getEventInviteOptions();

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-3xl font-semibold text-slate-900 dark:text-slate-100">
        Nieuw evenement
      </h1>
      <form
        action={createEventAction}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Titel</span>
          <input
            type="text"
            name="title"
            required
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Type</span>
          <select
            name="type"
            defaultValue="MEETING"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Datum</span>
            <input
              type="date"
              name="date"
              required
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Startuur</span>
            <input
              type="time"
              name="time"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Einduur</span>
            <input
              type="time"
              name="endTime"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Locatie</span>
          <input
            type="text"
            name="location"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Beschrijving
          </span>
          <textarea
            name="description"
            rows={4}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <EventInviteField
          users={inviteOptions.users}
          subagents={inviteOptions.subagents}
        />

        <div>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Evenement aanmaken
          </button>
        </div>
      </form>
    </div>
  );
}
