import Link from "next/link";
import { Plus, CalendarDays, MapPin, Users } from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getEventsForCurrentUser } from "@/lib/actions/events";
import { setMyAttendanceAction } from "@/lib/actions/events";
import { canManageEvents } from "@/lib/permissions";
import { Badge } from "@/components/Badge";

const TYPE_LABELS = { MEETING: "Vergadering", SEMINAR: "Seminarie" } as const;

export default async function EvenementenPage() {
  const user = (await getEffectiveViewer())!;
  const events = await getEventsForCurrentUser();
  const now = new Date();
  const upcoming = events.filter((e) => e.date >= now);
  const past = events.filter((e) => e.date < now).reverse();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold text-slate-900">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <CalendarDays size={20} />
            </span>
            Evenementen
          </h1>
          <p className="mt-1 text-base text-slate-500">
            Vergaderingen en seminaries — geef aan of je aanwezig zal zijn.
          </p>
        </div>
        {canManageEvents(user) && (
          <Link
            href="/evenementen/new"
            className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
          >
            <Plus size={17} />
            Nieuw evenement
          </Link>
        )}
      </div>

      <EventSection title="Aankomend" events={upcoming} />
      {past.length > 0 && <EventSection title="Voorbij" events={past} muted />}

      {events.length === 0 && (
        <p className="text-base text-slate-500">Nog geen evenementen.</p>
      )}
    </div>
  );
}

function EventSection({
  title,
  events,
  muted,
}: {
  title: string;
  events: Awaited<ReturnType<typeof getEventsForCurrentUser>>;
  muted?: boolean;
}) {
  if (events.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-xl font-medium text-slate-900">{title}</h2>
      <div className={`flex flex-col gap-3 ${muted ? "opacity-70" : ""}`}>
        {events.map((event) => (
          <div
            key={event.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <Link href={`/evenementen/${event.id}`} className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-slate-900 hover:underline">
                  {event.title}
                </h3>
                <Badge variant={event.type === "SEMINAR" ? "purple" : "blue"}>
                  {TYPE_LABELS[event.type]}
                </Badge>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span>
                  {event.date.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {event.location}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Users size={13} />
                  {event.goingCount} aanwezig
                </span>
              </p>
            </Link>
            <AttendanceButtons eventId={event.id} status={event.myStatus} />
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceButtons({
  eventId,
  status,
}: {
  eventId: string;
  status: "PENDING" | "GOING" | "NOT_GOING";
}) {
  const boundSetAttendance = setMyAttendanceAction.bind(null, eventId);
  return (
    <form action={boundSetAttendance} className="flex gap-2">
      <button
        type="submit"
        name="status"
        value="GOING"
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          status === "GOING"
            ? "bg-green-600 text-white"
            : "border border-slate-300 text-slate-600 hover:bg-slate-50"
        }`}
      >
        Aanwezig
      </button>
      <button
        type="submit"
        name="status"
        value="NOT_GOING"
        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
          status === "NOT_GOING"
            ? "bg-red-600 text-white"
            : "border border-slate-300 text-slate-600 hover:bg-slate-50"
        }`}
      >
        Niet aanwezig
      </button>
    </form>
  );
}
