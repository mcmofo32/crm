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
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds, canManageUsers } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { conversionBadgeVariant } from "@/lib/roleLabels";
import {
  getTeamOverviewForCoach,
  type EmployeeStats,
} from "@/lib/actions/analytics";
import { isBeheerder } from "@/lib/permissions";
import { getYearlyKpiProgress, computeMixedKpiPercent } from "@/lib/actions/goals";
import {
  getProductionMonthGoalProgress,
  getGroupProductionMonthGoalProgress,
  getCurrentProductionMonth,
  getCompanyProductionGoalProgress,
  getCompanyProductionContributions,
} from "@/lib/actions/production";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getUnverifiedPastVerifiableEvents } from "@/lib/actions/events";
import { getCrossOwnerDuplicateGroups } from "@/lib/actions/duplicates";
import { GOAL_METRIC_LABELS, KPI_METRIC_LABELS, MIXED_KPI_LABEL } from "@/lib/goalLabels";
import { Role } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { CompanyProductionMeter } from "@/components/CompanyProductionMeter";
import { CompanyProductionPieChart } from "@/components/CompanyProductionPieChart";

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
  if (percent === null) return "text-slate-400 dark:text-slate-500";
  if (percent >= 100) return "text-green-600 dark:text-green-400";
  if (percent >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

export default async function DashboardPage() {
  const user = (await getEffectiveViewer())!;
  const ids = await getVisibleUserIds(user);
  const now = new Date();
  const currentYear = now.getFullYear();
  // Groepsdoelen (totaal van het team/iedereen) enkel tonen aan wie ook
  // effectief een groep heeft: Coach (zijn team), Admin/Beheerder (iedereen).
  const showGroupGoals = canManageUsers(user) || user.role === Role.COACH;
  // getProductionMonthGoalProgress/getGroupProductionMonthGoalProgress
  // roepen hieronder via de Promise.all allebei getCurrentProductionMonth()
  // aan; die zit achter cache() (zie production.ts), dus door 'm hier al op
  // te lossen hergebruiken ze hetzelfde resultaat i.p.v. elk hun eigen,
  // identieke query te doen.
  await getCurrentProductionMonth();

  const [
    ownOverdueTasks,
    teamOverdueTasks,
    productionGoals,
    groupProductionGoals,
    yearlyKpis,
    teamOverview,
    unverifiedEvents,
    crossOwnerDuplicates,
    companyProductionGoal,
    companyProductionContributions,
  ] = await Promise.all([
    // Enkel de eigen verlopen taken van de ingelogde gebruiker — zelfde
    // logica als het badge-cijfer naast "Taken" in de layout.
    prisma.activity.count({
      where: {
        status: "PLANNED",
        scheduledAt: { lt: now },
        assigneeId: user.id,
        lead: { deletedAt: null },
      },
    }),
    // Verlopen taken van de rest van het team (dus niet de eigen), enkel
    // opgehaald/getoond vanaf Coach — een gewone User heeft geen team.
    showGroupGoals
      ? prisma.activity.count({
          where: {
            status: "PLANNED",
            scheduledAt: { lt: now },
            assigneeId: ids
              ? { in: ids.filter((id) => id !== user.id) }
              : { not: user.id },
            lead: { deletedAt: null },
          },
        })
      : Promise.resolve(0),
    getProductionMonthGoalProgress(user.id),
    showGroupGoals
      ? getAssignableUsers().then((users) =>
          getGroupProductionMonthGoalProgress(users.map((u) => u.id))
        )
      : Promise.resolve(null),
    getYearlyKpiProgress(user.id, currentYear),
    user.role === Role.COACH ? getTeamOverviewForCoach() : Promise.resolve(null),
    getUnverifiedPastVerifiableEvents(),
    getCrossOwnerDuplicateGroups(),
    showGroupGoals
      ? getCompanyProductionGoalProgress(currentYear)
      : Promise.resolve(null),
    showGroupGoals
      ? getCompanyProductionContributions(currentYear)
      : Promise.resolve(null),
  ]);
  const mixedKpiPercent = await computeMixedKpiPercent(yearlyKpis);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Welkom, {user.name}
        </h1>
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
          Hier is een overzicht van je doelen en opvolging.
        </p>
      </div>

      {ownOverdueTasks > 0 && (
        <Link
          href="/taken"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900/60"
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>
            <strong>{ownOverdueTasks}</strong>{" "}
            {ownOverdueTasks === 1
              ? "eigen geplande activiteit is verlopen zonder afronding."
              : "eigen geplande activiteiten zijn verlopen zonder afronding."}{" "}
            Bekijk taken →
          </span>
        </Link>
      )}

      {showGroupGoals && teamOverdueTasks > 0 && (
        <Link
          href="/taken?ownerId=groep"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900/60"
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>
            <strong>{teamOverdueTasks}</strong>{" "}
            {teamOverdueTasks === 1
              ? "geplande activiteit in je team is verlopen zonder afronding."
              : "geplande activiteiten in je team zijn verlopen zonder afronding."}{" "}
            Bekijk taken →
          </span>
        </Link>
      )}

      {unverifiedEvents.length > 0 && (
        <Link
          href={`/evenementen/${unverifiedEvents[0].id}`}
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900/60"
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>
            <strong>{unverifiedEvents.length}</strong>{" "}
            {unverifiedEvents.length === 1
              ? "seminarie/belsessie wacht op bevestiging van de aanwezigheid."
              : "seminaries/belsessies wachten op bevestiging van de aanwezigheid."}{" "}
            Bevestig nu →
          </span>
        </Link>
      )}

      {crossOwnerDuplicates.length > 0 && (
        <Link
          href="/beheer/duplicaten"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900/60"
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span>
            <strong>{crossOwnerDuplicates.length}</strong>{" "}
            {crossOwnerDuplicates.length === 1
              ? "dubbele lead gevonden bij verschillende medewerkers"
              : "dubbele leads gevonden bij verschillende medewerkers"}
            {" ("}
            {crossOwnerDuplicates
              .slice(0, 3)
              .map((g) =>
                Array.from(new Set(g.leads.map((l) => l.ownerName))).join(" & ")
              )
              .join(", ")}
            {crossOwnerDuplicates.length > 3 ? ", ..." : ""}
            {"). "}
            Bekijk duplicaten →
          </span>
        </Link>
      )}

      <div>
        <h2 className="mb-1 text-xl font-medium text-slate-900 dark:text-slate-100">
          Maandelijkse individuele doelen
        </h2>
        <div className="-mb-2 flex flex-col gap-0.5 text-sm text-slate-400 dark:text-slate-500">
          <p>
            Productiemaand {String(productionGoals.month).padStart(2, "0")} —{" "}
            {formatDate(productionGoals.periodStart)}
            {" – "}
            {formatDate(productionGoals.periodEnd)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
        {productionGoals.rows.map((goal) => (
          <GoalCard
            key={goal.metric}
            label={GOAL_METRIC_LABELS[goal.metric]}
            actual={goal.actual}
            target={goal.target}
            percent={goal.percent}
            icon={GOAL_ICONS[goal.metric]}
            percentPosition="below"
            accent="blue"
            emptyLabel="N.v.t."
          />
        ))}
      </div>

      {showGroupGoals && groupProductionGoals && (
        <div>
          <h2 className="mb-4 text-xl font-medium text-slate-900 dark:text-slate-100">
            Maandelijkse groepsdoelen
            <span className="ml-1.5 text-base font-normal text-slate-400 dark:text-slate-500">
              — totaal van {isBeheerder(user) ? "iedereen" : "je team"}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
            {groupProductionGoals.rows.map((goal) => (
              <GoalCard
                key={goal.metric}
                label={GOAL_METRIC_LABELS[goal.metric]}
                actual={goal.actual}
                target={goal.target}
                percent={goal.percent}
                icon={GOAL_ICONS[goal.metric]}
                percentPosition="below"
                accent="violet"
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-xl font-medium text-slate-900 dark:text-slate-100">
          Jaarlijkse KPI&apos;s
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5">
          {yearlyKpis.map((kpi) => (
            <GoalCard
              key={kpi.metric}
              label={KPI_METRIC_LABELS[kpi.metric]}
              actual={kpi.actual}
              target={kpi.target}
              percent={kpi.percent}
              icon={KPI_ICONS[kpi.metric]}
              percentPosition="below"
              accent="amber"
              emptyLabel="N.v.t."
            />
          ))}
          <GoalCard
            label={MIXED_KPI_LABEL}
            percent={mixedKpiPercent}
            icon={Gauge}
            percentPosition="below"
            accent="amber"
            emptyLabel="N.v.t."
          />
        </div>
      </div>

      {teamOverview && (
        <TeamOverviewTable
          title={`Mijn team — ${teamOverview.teamName}`}
          members={teamOverview.members}
        />
      )}

      {showGroupGoals && companyProductionGoal && companyProductionGoal.totalTarget > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-medium text-slate-900 dark:text-slate-100">
            Bedrijfsjaarplan
          </h2>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <CompanyProductionMeter year={currentYear} progress={companyProductionGoal} />
            {companyProductionContributions && (
              <CompanyProductionPieChart contributions={companyProductionContributions} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamOverviewTable({
  title,
  members,
}: {
  title: string;
  members: EmployeeStats[];
}) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-1.5 text-xl font-medium text-slate-900 dark:text-slate-100">
        <Users2 size={19} />
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-base">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th className="px-6 py-3 font-medium">Naam</th>
              <th className="px-6 py-3 font-medium">Leads</th>
              <th className="px-6 py-3 font-medium">Gewonnen</th>
              <th className="px-6 py-3 font-medium">Conversie</th>
              <th className="px-6 py-3 font-medium">Afgeronde contacten</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-2">
                    <Avatar name={member.name} photoUrl={member.photoUrl} />
                    {member.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{member.totalLeads}</td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{member.won}</td>
                <td className="px-6 py-4">
                  <Badge variant={conversionBadgeVariant(member.conversionRate)}>
                    {member.conversionRate === null ? "—" : `${member.conversionRate}%`}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                  {member.activitiesCompleted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const GOAL_CARD_ACCENTS = {
  blue: {
    border: "border-l-4 border-l-blue-400",
    icon: "bg-blue-100 text-blue-600",
  },
  violet: {
    border: "border-l-4 border-l-violet-400",
    icon: "bg-violet-100 text-violet-600",
  },
  amber: {
    border: "border-l-4 border-l-amber-400",
    icon: "bg-amber-100 text-amber-700",
  },
} as const;

function GoalCard({
  label,
  actual,
  target,
  percent,
  icon: Icon,
  percentPosition,
  percentSize = "text-2xl",
  accent,
  emptyLabel = "—",
}: {
  label: string;
  /** Weglaten verbergt de "behaald / doel"-regel — voor een kaart die enkel een percentage toont (bv. een samengestelde KPI zonder eigen telling). */
  actual?: number;
  target?: number;
  percent: number | null;
  icon: LucideIcon;
  percentPosition: "below" | "beside";
  percentSize?: string;
  accent: keyof typeof GOAL_CARD_ACCENTS;
  /** Getoond i.p.v. een percentage zolang percent null is (standaard een kale "—"). */
  emptyLabel?: string;
}) {
  const accentClasses = GOAL_CARD_ACCENTS[accent];
  const hasCount = actual !== undefined && target !== undefined;
  return (
    <div
      className={`rounded-xl border border-slate-200 ${accentClasses.border} bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-none`}
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${accentClasses.icon}`}
      >
        <Icon size={20} />
      </span>
      <p className="text-base text-slate-500 dark:text-slate-400">{label}</p>
      <div
        className={
          percentPosition === "beside"
            ? "mt-1 flex items-baseline gap-3"
            : "flex flex-col"
        }
      >
        {hasCount && (
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {formatValue(actual)}
            <span className="text-lg font-normal text-slate-400 dark:text-slate-500">
              {" "}
              / {formatValue(target)}
            </span>
          </p>
        )}
        <p
          className={`${
            percent === null ? "text-lg" : hasCount ? percentSize : "text-3xl"
          } font-semibold ${percentColor(percent)} ${
            percentPosition === "below" && hasCount ? "mt-1" : ""
          }`}
        >
          {percent === null ? emptyLabel : `${percent}%`}
        </p>
      </div>
    </div>
  );
}
