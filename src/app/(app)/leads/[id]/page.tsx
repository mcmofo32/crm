import { notFound, redirect } from "next/navigation";
import {
  Phone,
  CalendarClock,
  Mail,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { getEffectiveViewer } from "@/lib/impersonation";
import { prisma } from "@/lib/prisma";
import {
  canAccessOwner,
  canDeleteLeads,
  canDeleteActivities,
  canManageCustomerData,
  canManageUsers,
  getVisibleUserIds,
} from "@/lib/permissions";
import { getSubagents } from "@/lib/actions/subagents";
import { setCustomerOwnerAction } from "@/lib/actions/leadProducts";
import { StageSelect } from "@/components/StageSelect";
import { ActivityButtons } from "@/components/ActivityButtons";
import { QuickCallLogButton } from "@/components/QuickCallLogButton";
import { ReportContactForm } from "@/components/ReportContactForm";
import { ScheduleActivityForm } from "@/components/ScheduleActivityForm";
import { DeleteLeadButton } from "@/components/DeleteLeadButton";
import { LeadDetailsCard } from "@/components/LeadDetailsCard";
import { LeadProductsCard } from "@/components/LeadProductsCard";
import { FollowUpContractsCard } from "@/components/FollowUpContractsCard";
import { InlineSelect } from "@/components/InlineSelect";
import { Badge, type BadgeVariant } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { ToastOnParam } from "@/components/toast/ToastOnParam";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ duplicateName?: string; duplicateOwner?: string }>;
}) {
  const { id } = await params;
  const { duplicateName, duplicateOwner } = await searchParams;
  const [user, lead] = await Promise.all([
    getEffectiveViewer(),
    prisma.lead.findUnique({
      where: { id },
      include: {
        owner: true,
        stage: true,
        products: true,
        activities: {
          include: { assignee: { select: { name: true } } },
          orderBy: { scheduledAt: "desc" },
        },
      },
    }),
  ]);
  if (!user) redirect("/login");

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
  const [stages, assignableUsers, subagents] = await Promise.all([
    prisma.funnelStage.findMany({
      where: { leadType: lead.leadType },
      orderBy: { order: "asc" },
    }),
    prisma.user.findMany({
      where: visibleUserIds ? { id: { in: visibleUserIds } } : {},
      select: { id: true, name: true, googleCalendarConnected: true },
      orderBy: { name: "asc" },
    }),
    getSubagents(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <ToastOnParam param="created" message="Aangemaakt" />
      {duplicateName && duplicateOwner && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Let op: <strong>{duplicateName}</strong> staat al als lead
          geregistreerd bij <strong>{duplicateOwner}</strong> (zelfde
          e-mailadres of telefoonnummer). Deze nieuwe lead is wel aangemaakt —
          neem contact op met {duplicateOwner} om dubbel werk te vermijden.
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            {lead.firstName} {lead.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Avatar name={lead.owner.name} />
            Eigenaar:{" "}
            {lead.status === "WON" && canManageUsers(user) ? (
              <InlineSelect
                action={setCustomerOwnerAction.bind(null, lead.id)}
                name="ownerId"
                value={lead.ownerId}
                options={
                  assignableUsers.some((u) => u.id === lead.ownerId)
                    ? assignableUsers.map((u) => ({ value: u.id, label: u.name }))
                    : [
                        { value: lead.ownerId, label: lead.owner.name },
                        ...assignableUsers.map((u) => ({
                          value: u.id,
                          label: u.name,
                        })),
                      ]
                }
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm disabled:opacity-60"
              />
            ) : (
              lead.owner.name
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Laatste contact:{" "}
            <span className="font-medium text-slate-700">
              {lead.lastContactedAt
                ? lead.lastContactedAt.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/Brussels",
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
                    timeZone: "Europe/Brussels",
                  })
                : "Niet ingepland"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <StageSelect
            leadId={lead.id}
            currentStageId={lead.stageId}
            leadEmail={lead.email}
            stages={stages}
            subagents={subagents}
            canCloseDeals={canManageCustomerData(user)}
          />
          {canDeleteLeads(user, lead) && (
            <DeleteLeadButton
              leadId={lead.id}
              leadName={`${lead.firstName} ${lead.lastName}`}
              variant="button"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <LeadDetailsCard
            leadId={lead.id}
            firstName={lead.firstName}
            lastName={lead.lastName}
            email={lead.email}
            phone={lead.phone}
            source={lead.source}
            notes={lead.notes}
          />

          <LeadProductsCard
            leadId={lead.id}
            products={lead.products
              .filter((p) => !p.isFollowUp)
              .map((p) => ({
                type: p.type,
                amount: Number(p.amount),
                units: p.units,
              }))}
            canEdit={canManageCustomerData(user)}
          />

          {lead.status === "WON" && (
            <FollowUpContractsCard
              leadId={lead.id}
              contracts={lead.products
                .filter((p) => p.isFollowUp)
                .map((p) => ({
                  id: p.id,
                  type: p.type,
                  amount: Number(p.amount),
                  units: p.units,
                  contractDate: p.contractDate,
                }))}
              canEdit={canManageCustomerData(user)}
            />
          )}
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
          {canManageCustomerData(user) && (
            <ScheduleActivityForm
              leadId={lead.id}
              assignableUsers={assignableUsers}
              currentUserId={user.id}
              subagents={subagents}
            />
          )}

          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-slate-900">
                Communicatiegeschiedenis
              </h2>
              <div className="flex items-center gap-1.5">
                <QuickCallLogButton leadId={lead.id} />
                <ReportContactForm
                  leadId={lead.id}
                  assignableUsers={assignableUsers}
                  currentUserId={user.id}
                />
              </div>
            </div>
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
                    <div className="flex flex-wrap items-start justify-between gap-3">
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
                            {activity.wasVoicemail && (
                              <Badge variant="amber">Voicemail</Badge>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                            <Avatar name={activity.assignee.name} size="sm" />
                            {activity.assignee.name}
                          </div>
                        </div>
                      </div>
                      <ActivityButtons
                        activityId={activity.id}
                        type={activity.type}
                        subject={activity.subject}
                        scheduledAt={activity.scheduledAt}
                        durationMinutes={activity.durationMinutes}
                        status={activity.status}
                        canDelete={canDeleteActivities(user)}
                      />
                    </div>
                    {activity.scheduledAt && (
                      <p className="ml-[42px] mt-1 text-slate-500">
                        {activity.scheduledAt.toLocaleString("nl-BE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Europe/Brussels",
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
