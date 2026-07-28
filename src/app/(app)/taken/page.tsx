import Link from "next/link";
import {
  Phone,
  CalendarClock,
  Mail,
  StickyNote,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/permissions";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";
import { ActivityButtons } from "@/components/ActivityButtons";
import { Badge } from "@/components/Badge";

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
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const leadType =
    type === "FA" || type === "RG" ? (type as LeadType) : undefined;

  const session = await auth();
  const user = session!.user;
  const visibleUserIds = await getVisibleUserIds(user);
  const ownerWhere = visibleUserIds ? { ownerId: { in: visibleUserIds } } : {};

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

      <div className="flex gap-2 text-base">
        {(["ALLE", "FA", "RG"] as const).map((t) => (
          <Link
            key={t}
            href={t === "ALLE" ? "/taken" : `/taken?type=${t}`}
            className={`rounded-full px-4 py-1.5 ${
              (t === "ALLE" && !leadType) || t === leadType
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {t === "ALLE" ? "Alle" : LEAD_TYPE_LABELS[t]}
          </Link>
        ))}
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
                              <Badge variant={LEAD_TYPE_BADGE_VARIANT[task.lead.leadType]}>
                                {LEAD_TYPE_LABELS[task.lead.leadType]}
                              </Badge>
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
                                    { dateStyle: "medium", timeStyle: "short" }
                                  )
                                : "nog geen contact"}
                              {task.scheduledAt && (
                                <>
                                  {" · "}Volgend contact:{" "}
                                  {task.scheduledAt.toLocaleString("nl-BE", {
                                    dateStyle: "medium",
                                    timeStyle: "short",
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
                          notes={task.notes}
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
