import Link from "next/link";
import {
  AlertTriangle,
  Users2,
  Boxes,
  UserCheck,
  Phone,
  Euro,
  Briefcase,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { conversionBadgeVariant } from "@/lib/roleLabels";
import { getTeamOverviewForCoach } from "@/lib/actions/analytics";
import {
  getCurrentGoalPeriod,
  getWeeklyGoalProgress,
  getYearlyKpiProgress,
} from "@/lib/actions/goals";
import { GOAL_METRIC_LABELS, KPI_METRIC_LABELS } from "@/lib/goalLabels";
import { Role } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";

const GOAL_ICONS: Record<string, LucideIcon> = {
  UNITS: Boxes,
  CUSTOMERS: UserCheck,
  CONVERSATIONS: Phone,
  ABV_SALES: Euro,
  ABV_RG: Briefcase,
};

const KPI_ICONS: Record<string, LucideIcon> = {
  CONVERSATIONS: Phone,
  PRODUCTION: Euro,
  CALLING_SESSION: Phone,
  SEMINAR: Presentation,
};

function formatValue(value: number) {
  return value % 1 === 0
    ? value.toLocaleString("nl-BE")
    : value.toLocaleString("nl-BE", { maximumFractionDigits: 2 });
}

function percentColor(percent: number | null) {
  if (percent === null) return "text-slate-400";
  if (percent >= 100) return "text-green-600";
  if (percent >= 60) return "text-amber-600";
  return "text-red-600";
}

export default async function DashboardPage() {
  const user = (await getEffectiveViewer())!;
  const ids = await getVisibleUserIds(user);
  const ownerWhere = ids ? { ownerId: { in: ids } } : {};
  const leadWhere = { deletedAt: null, ...ownerWhere };
  const now = new Date();
  const currentYear = now.getFullYear();

  const goalPeriod = await getCurrentGoalPeriod();

  const [overdueTasks, weeklyGoals, yearlyKpis, teamOverview] = await Promise.all([
    prisma.activity.count({
      where: { status: "PLANNED", scheduledAt: { lt: now }, lead: leadWhere },
    }),
    getWeeklyGoalProgress(user.id, goalPeriod),
    getYearlyKpiProgress(user.id, currentYear),
    user.role === Role.COACH ? getTeamOverviewForCoach() : Promise.resolve(null),
  ]);

  const seminarKpi = yearlyKpis.find((k) => k.metric === "SEMINAR");
  const otherKpis = yearlyKpis.filter((k) => k.metric !== "SEMINAR");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Welkom, {user.name}
        </h1>
        <p className="mt-1 text-base text-slate-500">
          Hier is een overzicht van je doelen en opvolging.
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

      <p className="-mb-2 text-sm text-slate-400">
        Periode:{" "}
        {goalPeriod.startDate.toLocaleDateString("nl-BE", { dateStyle: "medium" })}
        {" – "}
        {goalPeriod.endDate.toLocaleDateString("nl-BE", { dateStyle: "medium" })}
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        {weeklyGoals.map((goal) => (
          <GoalCard
            key={goal.metric}
            label={GOAL_METRIC_LABELS[goal.metric]}
            actual={goal.actual}
            target={goal.target}
            percent={goal.percent}
            icon={GOAL_ICONS[goal.metric]}
            percentPosition={goal.metric === "ABV_RG" ? "beside" : "below"}
          />
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-medium text-slate-900">
          Productie jaarlijks
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
          {otherKpis.map((kpi) => (
            <GoalCard
              key={kpi.metric}
              label={KPI_METRIC_LABELS[kpi.metric]}
              actual={kpi.actual}
              target={kpi.target}
              percent={kpi.percent}
              icon={KPI_ICONS[kpi.metric]}
              percentPosition="below"
            />
          ))}
          {seminarKpi && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Presentation size={20} />
              </span>
              <p className="text-base text-slate-500">
                {KPI_METRIC_LABELS.SEMINAR}
              </p>
              <p className={`mt-1 text-4xl font-semibold ${percentColor(seminarKpi.percent)}`}>
                {seminarKpi.percent === null ? "—" : `${seminarKpi.percent}%`}
              </p>
            </div>
          )}
        </div>
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

function GoalCard({
  label,
  actual,
  target,
  percent,
  icon: Icon,
  percentPosition,
}: {
  label: string;
  actual: number;
  target: number;
  percent: number | null;
  icon: LucideIcon;
  percentPosition: "below" | "beside";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon size={20} />
      </span>
      <p className="text-base text-slate-500">{label}</p>
      <div
        className={
          percentPosition === "beside"
            ? "mt-1 flex items-baseline gap-3"
            : "flex flex-col"
        }
      >
        <p className="text-3xl font-semibold text-slate-900">
          {formatValue(actual)}
          <span className="text-lg font-normal text-slate-400">
            {" "}
            / {formatValue(target)}
          </span>
        </p>
        <p
          className={`text-sm font-medium ${percentColor(percent)} ${
            percentPosition === "below" ? "mt-1" : ""
          }`}
        >
          {percent === null ? "—" : `${percent}%`}
        </p>
      </div>
    </div>
  );
}
