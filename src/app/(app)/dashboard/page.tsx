import Link from "next/link";
import {
  TrendingUp,
  Briefcase,
  Trophy,
  ListChecks,
  Phone,
  CalendarClock,
  Mail,
  StickyNote,
  AlertTriangle,
  Users2,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/permissions";
import { LEAD_TYPE_LABELS, conversionBadgeVariant } from "@/lib/roleLabels";
import { getTeamOverviewForCoach } from "@/lib/actions/analytics";
import { LeadStatus, LeadType, Role } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  CALL: Phone,
  MEETING: CalendarClock,
  EMAIL: Mail,
  NOTE: StickyNote,
};

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const ids = await getVisibleUserIds(user);
  const ownerWhere = ids ? { ownerId: { in: ids } } : {};
  const leadWhere = { deletedAt: null, ...ownerWhere };
  const now = new Date();

  const [openFA, openRG, wonCount, openTasks, overdueTasks, upcomingCalls] =
    await Promise.all([
      prisma.lead.count({
        where: { ...leadWhere, leadType: LeadType.FA, status: LeadStatus.OPEN },
      }),
      prisma.lead.count({
        where: { ...leadWhere, leadType: LeadType.RG, status: LeadStatus.OPEN },
      }),
      prisma.lead.count({ where: { ...leadWhere, status: LeadStatus.WON } }),
      prisma.activity.count({
        where: { status: "PLANNED", lead: leadWhere },
      }),
      prisma.activity.count({
        where: { status: "PLANNED", scheduledAt: { lt: now }, lead: leadWhere },
      }),
      prisma.activity.findMany({
        where: {
          status: "PLANNED",
          scheduledAt: { gte: now },
          lead: leadWhere,
        },
        include: { lead: true },
        orderBy: { scheduledAt: "asc" },
        take: 8,
      }),
    ]);

  const teamOverview =
    user.role === Role.COACH ? await getTeamOverviewForCoach() : null;

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Welkom, {user.name}
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Hier is een overzicht van je leads en geplande opvolging.
        </p>
      </div>

      {overdueTasks > 0 && (
        <Link
          href="/taken"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100"
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>
            <strong>{overdueTasks}</strong>{" "}
            {overdueTasks === 1
              ? "geplande activiteit is verlopen zonder afronding."
              : "geplande activiteiten zijn verlopen zonder afronding."}{" "}
            Bekijk taken →
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Open — ${LEAD_TYPE_LABELS.FA}`}
          value={openFA}
          href="/funnel/FA"
          icon={TrendingUp}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          label={`Open — ${LEAD_TYPE_LABELS.RG}`}
          value={openRG}
          href="/funnel/RG"
          icon={Briefcase}
          color="bg-purple-100 text-purple-700"
        />
        <StatCard
          label="Gewonnen leads"
          value={wonCount}
          href="/leads"
          icon={Trophy}
          color="bg-green-100 text-green-700"
        />
        <StatCard
          label="Openstaande taken"
          value={openTasks}
          href="/taken"
          icon={ListChecks}
          color="bg-amber-100 text-amber-700"
        />
      </div>

      <div>
        <h2 className="mb-4 text-xl font-medium text-slate-900">
          Geplande gesprekken
        </h2>
        {upcomingCalls.length === 0 ? (
          <p className="text-base text-slate-500">
            Geen geplande activiteiten.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {upcomingCalls.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] ?? Phone;
              return (
                <li
                  key={activity.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                      <Icon size={17} />
                    </span>
                    <div>
                      <Link
                        href={`/leads/${activity.leadId}`}
                        className="text-base font-medium text-slate-900 hover:underline"
                      >
                        {activity.subject}
                      </Link>
                      <p className="text-base text-slate-500">
                        {activity.lead.firstName} {activity.lead.lastName}
                      </p>
                    </div>
                  </div>
                  <span className="text-base text-slate-500">
                    {activity.scheduledAt?.toLocaleString("nl-BE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {teamOverview && (
        <div>
          <h2 className="mb-4 flex items-center gap-1.5 text-xl font-medium text-slate-900">
            <Users2 size={19} />
            Mijn team — {teamOverview.teamName}
          </h2>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-base">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-medium">Naam</th>
                  <th className="px-6 py-3 font-medium">Leads</th>
                  <th className="px-6 py-3 font-medium">Gewonnen</th>
                  <th className="px-6 py-3 font-medium">Conversie</th>
                  <th className="px-6 py-3 font-medium">Afgeronde contacten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamOverview.members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <Avatar name={member.name} />
                        {member.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {member.totalLeads}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{member.won}</td>
                    <td className="px-6 py-4">
                      <Badge variant={conversionBadgeVariant(member.conversionRate)}>
                        {member.conversionRate === null
                          ? "—"
                          : `${member.conversionRate}%`}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {member.activitiesCompleted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  href: string;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}
      >
        <Icon size={20} />
      </span>
      <p className="text-base text-slate-500">{label}</p>
      <p className="mt-1 text-4xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
