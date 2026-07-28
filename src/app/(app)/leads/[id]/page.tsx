import { notFound, redirect } from "next/navigation";
import {
  Phone,
  CalendarClock,
  Mail,
  StickyNote,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessOwner, canDeleteLeads, getVisibleUserIds } from "@/lib/permissions";
import { scheduleActivityAction } from "@/lib/actions/activities";
import { LEAD_TYPE_LABELS, LEAD_TYPE_BADGE_VARIANT } from "@/lib/roleLabels";
import { StageSelect } from "./StageSelect";
import { ActivityButtons } from "@/components/ActivityButtons";
import { ReportContactForm } from "@/components/ReportContactForm";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";
import { Badge, type BadgeVariant } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

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

const ACTIVITY_STATUS_LABELS = {
  PLANNED: "Gepland",
  COMPLETED: "Afgerond",
  CANCELLED: "Geannuleerd",
  NO_SHOW: "Niet komen opdagen",
};

const ACTIVITY_STATUS_BADGE_VARIANT: Record<string, BadgeVariant> = {
  PLANNED: "amber",
  COMPLETED: "green",
  CANCELLED: "slate",
  NO_SHOW: "red",
};

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: true,
      stage: true,
      activities: {
        include: { assignee: { select: { name: true } } },
        orderBy: { scheduledAt: "desc" },
      },
    },
  });

  if (!lead || lead.deletedAt) notFound();
  if (!(await canAccessOwner(user, lead.ownerId))) notFound();

  const now = new Date();
  const nextContact = lead.activities
    .filter(
      (a): a is typeof a & { scheduledAt: Date } =>
        a.status === "PLANNED" && a.scheduledAt !== null && a.scheduledAt >= now
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())[0];

  const visibleUserIds = await getVisibleUserIds(user);
  const [stages, assignableUsers] = await Promise.all([
    prisma.funnelStage.findMany({
      where: { leadType: lead.leadType },
      orderBy: { order: "asc" },
    }),
    prisma.user.findMany({
      where: visibleUserIds ? { id: { in: visibleUserIds } } : {},
      select: { id: true, name: true, googleCalendarConnected: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-slate-900">
              {lead.firstName} {lead.lastName}
            </h1>
            <Badge variant={LEAD_TYPE_BADGE_VARIANT[lead.leadType]}>
              {LEAD_TYPE_LABELS[lead.leadType]}
            </Badge>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Avatar name={lead.owner.name} />
            Eigenaar: {lead.owner.name}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Laatste contact:{" "}
            <span className="font-medium text-slate-700">
              {lead.lastContactedAt
                ? lead.lastContactedAt.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Nog geen contact"}
            </span>
            {" · "}
            Volgend contact:{" "}
            <span className="font-medium text-slate-700">
              {nextContact
                ? nextContact.scheduledAt.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Niet ingepland"}
            </span>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <StageSelect
            leadId={lead.id}
            currentStageId={lead.stageId}
            stages={stages}
          />
          {canDeleteLeads(user) && (
            <DeleteLeadButton
              leadId={lead.id}
              leadName={`${lead.firstName} ${lead.lastName}`}
              variant="button"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-3 font-medium text-slate-900">Contactgegevens</h2>
          <dl className="flex flex-col gap-3">
            <Row icon={Mail} label="E-mail" value={lead.email} />
            <Row icon={Phone} label="Telefoon" value={lead.phone} />
            <Row icon={Building2} label="Bedrijf" value={lead.company} />
            <Row label="Bron" value={lead.source} />
          </dl>
          {lead.notes && (
            <p className="mt-3 whitespace-pre-wrap text-slate-600">
              {lead.notes}
            </p>
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          <ReportContactForm
            leadId={lead.id}
            assignableUsers={assignableUsers}
            currentUserId={user.id}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-900">
              Volgend gesprek inplannen
            </h2>
            <form
              action={scheduleActivityAction}
              className="grid grid-cols-2 gap-3 text-sm"
            >
              <input type="hidden" name="leadId" value={lead.id} />

              <select
                name="type"
                defaultValue="CALL"
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                name="assigneeId"
                defaultValue={user.id}
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.googleCalendarConnected ? " (agenda gekoppeld)" : ""}
                  </option>
                ))}
              </select>

              <input
                name="subject"
                placeholder="Onderwerp"
                defaultValue="Opvolgingsgesprek"
                required
                className="col-span-2 rounded-md border border-slate-300 px-3 py-2"
              />

              <input
                type="datetime-local"
                name="scheduledAt"
                required
                className="rounded-md border border-slate-300 px-3 py-2"
              />

              <select
                name="durationMinutes"
                defaultValue="15"
                className="rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>

              <textarea
                name="notes"
                placeholder="Notities"
                rows={2}
                className="col-span-2 rounded-md border border-slate-300 px-3 py-2"
              />

              <button
                type="submit"
                className="col-span-2 mt-1 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
              >
                Inplannen
              </button>
            </form>
            <p className="mt-2 text-xs text-slate-400">
              Wanneer de toegewezen gebruiker zijn Google Agenda gekoppeld
              heeft (zie Instellingen), wordt dit automatisch als
              agenda-item aangemaakt.
            </p>
          </div>

          <div>
            <h2 className="mb-1 text-sm font-medium text-slate-900">
              Communicatiegeschiedenis
            </h2>
            <p className="mb-3 text-xs text-slate-400">
              Alle contactmomenten en geplande opvolging voor deze lead, nieuwste eerst.
            </p>
            <ul className="flex flex-col gap-2">
              {lead.activities.map((activity) => {
                const Icon = ACTIVITY_TYPE_ICONS[activity.type] ?? StickyNote;
                return (
                  <li
                    key={activity.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <Icon size={15} />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {activity.subject}
                            </span>
                            <Badge
                              variant={
                                ACTIVITY_STATUS_BADGE_VARIANT[activity.status]
                              }
                            >
                              {ACTIVITY_STATUS_LABELS[activity.status]}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                            <Avatar name={activity.assignee.name} size="sm" />
                            {activity.assignee.name}
                          </div>
                        </div>
                      </div>
                      {activity.status === "PLANNED" && (
                        <ActivityButtons
                          activityId={activity.id}
                          type={activity.type}
                          subject={activity.subject}
                          scheduledAt={activity.scheduledAt}
                          durationMinutes={activity.durationMinutes}
                          notes={activity.notes}
                        />
                      )}
                    </div>
                    {activity.scheduledAt && (
                      <p className="ml-[42px] mt-1 text-slate-500">
                        {activity.scheduledAt.toLocaleString("nl-BE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {activity.notes && (
                      <p className="ml-[42px] mt-1 whitespace-pre-wrap text-slate-600">
                        {activity.notes}
                      </p>
                    )}
                    {activity.googleSyncError && (
                      <p className="ml-[42px] mt-1 text-xs text-red-600">
                        Google Agenda-synchronisatie mislukt:{" "}
                        {activity.googleSyncError}
                      </p>
                    )}
                  </li>
                );
              })}
              {lead.activities.length === 0 && (
                <p className="text-sm text-slate-400">
                  Nog geen communicatie gelogd voor deze lead.
                </p>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: LucideIcon;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex items-center gap-1.5 text-slate-400">
        {Icon && <Icon size={14} />}
        {label}
      </dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
