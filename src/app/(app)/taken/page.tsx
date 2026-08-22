import Link from "next/link";
import {
  Phone,
  CalendarClock,
  Mail,
  StickyNote,
  AlertTriangle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import { canDeleteActivities, canManageUsers } from "@/lib/permissions";
import { getAssignableUsers } from "@/lib/actions/leads";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import { LeadType, Role } from "@/generated/prisma/client";
import { ActivityButtons } from "@/components/ActivityButtons";

/** Sentinelwaarde voor "iedereen die ik mag zien" (heel mijn team, of voor Admin/Beheerder alle medewerkers). */
const GROUP_OPTION = "groep";

const ACTIVITY_TYPE_LABELS = {
  CALL: "Telefoongesprek",
  MEETING: "Afspraak",
  EMAIL: "E-mail",
  NOTE: "Notitie",
};

const ACTIVITY_TYPE_ICONS: Record<string, LucideIcon> = {
  CALL: Phone,
  MEETING: CalendarClock,
  EMAIL: Mail,
  NOTE: StickyNote,
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function TakenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; ownerId?: string }>;
}) {
  const { type, ownerId } = await searchParams;
  const leadType =
    type === "FA" || type === "RG" ? (type as LeadType) : undefined;

  const user = (await getEffectiveViewer())!;
  // Admin/Coach/Beheerder kunnen kiezen om de taken van een specifieke
  // medewerker (of iedereen/heel hun team) te zien; standaard — en voor een
  // gewone User altijd — zie je enkel je eigen taken.
  const canFilterScope = canManageUsers(user) || user.role === Role.COACH;
  const assignableUsers = canFilterScope ? await getAssignableUsers() : [];
  const selectedOwnerId =
    canFilterScope &&
    ownerId &&
    (ownerId === GROUP_OPTION || assignableUsers.some((u) => u.id === ownerId))
      ? ownerId
      : user.id;
  const isGroupView = selectedOwnerId === GROUP_OPTION;
  const ownerWhere = isGroupView
    ? { ownerId: { in: assignableUsers.map((u) => u.id) } }
    : { ownerId: selectedOwnerId };

  const tasks = await prisma.activity.findMany({
    where: {
      status: "PLANNED",
      lead: { deletedAt: null, ...ownerWhere, ...(leadType ? { leadType } : {}) },
    },
    include: {
      lead: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          leadType: true,
          lastContactedAt: true,
        },
      },
      assignee: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 3600 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 3600 * 1000);

  const buckets: { label: string; tasks: typeof tasks }[] = [
    { label: "Verlopen", tasks: [] },
    { label: "Vandaag", tasks: [] },
    { label: "Deze week", tasks: [] },
    { label: "Later", tasks: [] },
    { label: "Zonder datum", tasks: [] },
  ];

  for (const task of tasks) {
    if (!task.scheduledAt) {
      buckets[4].tasks.push(task);
    } else if (task.scheduledAt < now) {
      buckets[0].tasks.push(task);
    } else if (task.scheduledAt < tomorrowStart) {
      buckets[1].tasks.push(task);
    } else if (task.scheduledAt < weekEnd) {
      buckets[2].tasks.push(task);
    } else {
      buckets[3].tasks.push(task);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Taken</h1>
        <p className="mt-1 text-base text-slate-500">
          Alle geplande opvolging over Leads FA en Leads RG, op één plek.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 text-base">
          {(["ALLE", "FA", "RG"] as const).map((t) => {
            const params = new URLSearchParams();
            if (t !== "ALLE") params.set("type", t);
            if (selectedOwnerId !== user.id) params.set("ownerId", selectedOwnerId);
            const qs = params.toString();
            return (
              <Link
                key={t}
                href={qs ? `/taken?${qs}` : "/taken"}
                className={`rounded-full px-4 py-1.5 ${
                  (t === "ALLE" && !leadType) || t === leadType
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {t === "ALLE" ? "Alle" : LEAD_TYPE_LABELS[t]}
              </Link>
            );
          })}
        </div>

        {canFilterScope && (
          <form
            method="GET"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-sm"
          >
            {leadType && <input type="hidden" name="type" value={leadType} />}
            <Users size={17} className="text-slate-400" />
            <label className="text-slate-600">Bekijk taken van:</label>
            <select
              name="ownerId"
              defaultValue={selectedOwnerId}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value={user.id}>Mezelf</option>
              <option value={GROUP_OPTION}>
                {canManageUsers(user) ? "Iedereen" : "Heel mijn team"}
              </option>
              {assignableUsers
                .filter((u) => u.id !== user.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-800"
            >
              Bekijken
            </button>
          </form>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="text-base text-slate-500">
          Geen openstaande taken. Alles is opgevolgd.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {buckets
            .filter((bucket) => bucket.tasks.length > 0)
            .map((bucket) => (
              <div key={bucket.label}>
                <h2
                  className={`mb-3 flex items-center gap-1.5 text-lg font-medium ${
                    bucket.label === "Verlopen"
                      ? "text-red-600"
                      : "text-slate-900"
                  }`}
                >
                  {bucket.label === "Verlopen" && <AlertTriangle size={17} />}
                  {bucket.label}{" "}
                  <span className="text-base font-normal text-slate-400">
                    ({bucket.tasks.length})
                  </span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {bucket.tasks.map((task) => {
                    const Icon = ACTIVITY_TYPE_ICONS[task.type] ?? StickyNote;
                    return (
                      <li
                        key={task.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 text-base"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                            <Icon size={16} />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/leads/${task.lead.id}`}
                                className="font-medium text-slate-900 hover:underline"
                              >
                                {task.lead.firstName} {task.lead.lastName}
                              </Link>
                            </div>
                            <p className="text-slate-500">
                              {ACTIVITY_TYPE_LABELS[task.type]} · {task.subject} ·{" "}
                              {task.assignee.name}
                            </p>
                            <p className="text-sm text-slate-400">
                              Laatste contact:{" "}
                              {task.lead.lastContactedAt
                                ? task.lead.lastContactedAt.toLocaleString(
                                    "nl-BE",
                                    {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                      timeZone: "Europe/Brussels",
                                    }
                                  )
                                : "nog geen contact"}
                              {task.scheduledAt && (
                                <>
                                  {" · "}Volgend contact:{" "}
                                  {task.scheduledAt.toLocaleString("nl-BE", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                    timeZone: "Europe/Brussels",
                                  })}
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <ActivityButtons
                          activityId={task.id}
                          type={task.type}
                          subject={task.subject}
                          scheduledAt={task.scheduledAt}
                          durationMinutes={task.durationMinutes}
                          status={task.status}
                          canDelete={canDeleteActivities(user)}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
