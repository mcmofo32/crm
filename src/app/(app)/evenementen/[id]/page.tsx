import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { getEventForDetail, setMyAttendanceAction } from "@/lib/actions/events";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { DeleteEventButton } from "@/components/DeleteEventButton";

const TYPE_LABELS = { MEETING: "Vergadering", SEMINAR: "Seminarie" } as const;
const STATUS_LABELS = {
  PENDING: "Nog niet gereageerd",
  GOING: "Aanwezig",
  NOT_GOING: "Niet aanwezig",
} as const;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEventForDetail(id);
  if (!event) notFound();

  const boundSetAttendance = setMyAttendanceAction.bind(null, id);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <Link
          href="/evenementen"
          className="mb-2 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={15} />
          Terug naar overzicht
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold text-slate-900">
            {event.title}
          </h1>
          <Badge variant={event.type === "SEMINAR" ? "purple" : "blue"}>
            {TYPE_LABELS[event.type]}
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-6">
        <p className="flex items-center gap-2 text-base text-slate-700">
          <CalendarDays size={17} className="text-slate-400" />
          {event.date.toLocaleString("nl-BE", {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </p>
        {event.location && (
          <p className="flex items-center gap-2 text-base text-slate-700">
            <MapPin size={17} className="text-slate-400" />
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="mt-2 whitespace-pre-line text-base text-slate-600">
            {event.description}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Jouw aanwezigheid
        </h2>
        <p className="mb-3 text-sm text-slate-500">
          Huidige status: <strong>{STATUS_LABELS[event.myStatus]}</strong>
        </p>
        <form action={boundSetAttendance} className="flex gap-2">
          <button
            type="submit"
            name="status"
            value="GOING"
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              event.myStatus === "GOING"
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
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              event.myStatus === "NOT_GOING"
                ? "bg-red-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Niet aanwezig
          </button>
        </form>
      </div>

      {event.canManage && (
        <>
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-medium text-slate-900">
              Aanwezigheid teamleden
            </h2>
            {event.attendances.length === 0 ? (
              <p className="text-sm text-slate-400">Nog geen reacties.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {event.attendances.map((a) => (
                  <li
                    key={a.userId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <Avatar name={a.name} />
                      {a.name}
                    </span>
                    <Badge
                      variant={
                        a.status === "GOING"
                          ? "green"
                          : a.status === "NOT_GOING"
                          ? "red"
                          : "slate"
                      }
                    >
                      {STATUS_LABELS[a.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <DeleteEventButton eventId={event.id} eventTitle={event.title} />
          </div>
        </>
      )}
    </div>
  );
}
