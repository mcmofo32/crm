import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessOwner, getVisibleUserIds } from "@/lib/permissions";
import { scheduleActivityAction } from "@/lib/actions/activities";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import { StageSelect } from "./StageSelect";
import { ActivityButtons } from "@/components/ActivityButtons";
import { ReportContactForm } from "@/components/ReportContactForm";

const ACTIVITY_TYPE_LABELS = {
  CALL: "Telefoongesprek",
  MEETING: "Afspraak",
  EMAIL: "E-mail",
  NOTE: "Notitie",
};

const ACTIVITY_STATUS_LABELS = {
  PLANNED: "Gepland",
  COMPLETED: "Afgerond",
  CANCELLED: "Geannuleerd",
  NO_SHOW: "Niet komen opdagen",
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

  if (!lead) notFound();
  if (!(await canAccessOwner(user, lead.ownerId))) notFound();

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
          <h1 className="text-3xl font-semibold text-slate-900">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="text-sm text-slate-500">
            {LEAD_TYPE_LABELS[lead.leadType]} · Eigenaar: {lead.owner.name}
          </p>
        </div>
        <StageSelect
          leadId={lead.id}
          currentStageId={lead.stageId}
          stages={stages}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-3 font-medium text-slate-900">Contactgegevens</h2>
          <dl className="flex flex-col gap-2">
            <Row label="E-mail" value={lead.email} />
            <Row label="Telefoon" value={lead.phone} />
            <Row label="Bedrijf" value={lead.company} />
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
              {lead.activities.map((activity) => (
                <li
                  key={activity.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">
                        {activity.subject}
                      </span>
                      <span className="ml-2 text-xs text-slate-400">
                        {ACTIVITY_TYPE_LABELS[activity.type]} ·{" "}
                        {ACTIVITY_STATUS_LABELS[activity.status]} ·{" "}
                        {activity.assignee.name}
                      </span>
                    </div>
                    {activity.status === "PLANNED" && (
                      <ActivityButtons activityId={activity.id} />
                    )}
                  </div>
                  {activity.scheduledAt && (
                    <p className="mt-1 text-slate-500">
                      {activity.scheduledAt.toLocaleString("nl-BE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                  {activity.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-slate-600">
                      {activity.notes}
                    </p>
                  )}
                  {activity.googleSyncError && (
                    <p className="mt-1 text-xs text-red-600">
                      Google Agenda-synchronisatie mislukt:{" "}
                      {activity.googleSyncError}
                    </p>
                  )}
                </li>
              ))}
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

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right text-slate-700">{value}</dd>
    </div>
  );
}
