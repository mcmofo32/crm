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
import { getVisibleUserIds, canManageUsers } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { conversionBadgeVariant } from "@/lib/roleLabels";
import {
  getTeamOverviewForCoach,
  getAllTeamOverviews,
  type EmployeeStats,
} from "@/lib/actions/analytics";
import { isBeheerder } from "@/lib/permissions";
import { getYearlyKpiProgress } from "@/lib/actions/goals";
import {
  getProductionMonthGoalProgress,
  getGroupProductionMonthGoalProgress,
  getCurrentProductionMonth,
  getProductionLeaderboard,
  getConversationsLeaderboard,
} from "@/lib/actions/production";
import { getAssignableUsers } from "@/lib/actions/leads";
import { getUnverifiedPastVerifiableEvents } from "@/lib/actions/events";
import { getCrossOwnerDuplicateGroups } from "@/lib/actions/duplicates";
import { GOAL_METRIC_LABELS, KPI_METRIC_LABELS } from "@/lib/goalLabels";
import { Role } from "@/generated/prisma/client";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { Position } from "@/components/ProductionShared";

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

function formatDate(date: Date) {
  return date.toLocaleDateString("nl-BE", { dateStyle: "medium" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const { team: selectedTeamId } = await searchParams;
  const user = (await getEffectiveViewer())!;
  const ids = await getVisibleUserIds(user);
  const now = new Date();
  const currentYear = now.getFullYear();
  // Groepsdoelen (totaal van het team/iedereen) enkel tonen aan wie ook
  // effectief een groep heeft: Coach (zijn team), Admin/Beheerder (iedereen).
  const showGroupGoals = canManageUsers(user) || user.role === Role.COACH;
  // getProductionLeaderboard hieronder heeft year/month als expliciete
  // argumenten nodig, dus dit moet vóór de Promise.all opgelost zijn. Zit
  // wel achter cache() (zie production.ts), dus alle andere plekken die
  // hieronder óók getCurrentProductionMonth() aanroepen (via
  // getProductionMonthGoalProgress, getGroupProductionMonthGoalProgress,
  // getConversationsLeaderboard, ...) hergebruiken dit resultaat i.p.v. elk
  // hun eigen, identieke query te doen.
  const currentProductionMonth = await getCurrentProductionMonth();

  const [
    ownOverdueTasks,
    teamOverdueTasks,
    productionGoals,
    groupProductionGoals,
    yearlyKpis,
    teamOverview,
    allTeamOverviews,
    unverifiedEvents,
    crossOwnerDuplicates,
    productionRows,
    conversationsRows,
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
    isBeheerder(user) ? getAllTeamOverviews() : Promise.resolve(null),
    getUnverifiedPastVerifiableEvents(),
    getCrossOwnerDuplicateGroups(),
    getProductionLeaderboard(currentProductionMonth.year, currentProductionMonth.month),
    getConversationsLeaderboard(),
  ]);

  const activeTeam =
    allTeamOverviews?.find((t) => t.teamId === selectedTeamId) ??
    allTeamOverviews?.[0] ??
    null;

  // Compact overzicht op het dashboard: alle actieve medewerkers, met de
  // Gesprekken-doel/percentage erbij gemengd zodat je in één tabelletje
  // zowel Productie als Gesprekken ziet (net als de aparte tabbladen). De
  // lijst zelf toont iedereen — enkel de tabel krijgt een vaste (scrollbare)
  // hoogte zodat het dashboard niet te lang wordt.
  const conversationsByUserId = new Map(conversationsRows.map((r) => [r.id, r]));
  const compactProductionRows = productionRows.map((row) => ({
    ...row,
    conversationsTarget: conversationsByUserId.get(row.id)?.target ?? 0,
    conversationsPercent: conversationsByUserId.get(row.id)?.percent ?? null,
  }));

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

      {ownOverdueTasks > 0 && (
        <Link
          href="/taken"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100"
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
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100"
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
          className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-base text-amber-800 hover:bg-amber-100"
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
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-4 text-base text-red-700 hover:bg-red-100"
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
        <h2 className="mb-1 text-xl font-medium text-slate-900">
          Maandelijkse individuele doelen
        </h2>
        <div className="-mb-2 flex flex-col gap-0.5 text-sm text-slate-400">
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
          />
        ))}
      </div>

      {showGroupGoals && groupProductionGoals && (
        <div>
          <h2 className="mb-4 text-xl font-medium text-slate-900">
            Maandelijkse groepsdoelen
            <span className="ml-1.5 text-base font-normal text-slate-400">
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
        <h2 className="mb-4 text-xl font-medium text-slate-900">
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
            />
          ))}
        </div>
      </div>

      {compactProductionRows.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-medium text-slate-900">
              Productie &amp; gesprekken
              <span className="ml-1.5 text-base font-normal text-slate-400">
                — productiemaand {String(currentProductionMonth.month).padStart(2, "0")}
              </span>
            </h2>
            <Link
              href="/productie"
              className="text-sm text-slate-500 hover:text-slate-700 hover:underline"
            >
              Volledige ranglijst →
            </Link>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Naam</th>
                  <th className="px-3 py-2 text-center font-medium">Klanten</th>
                  <th className="px-3 py-2 text-center font-medium">Eenheden</th>
                  <th className="px-3 py-2 text-center font-medium">
                    Gesprekken/week
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {compactProductionRows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Position position={i + 1} />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {row.name}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <LeaderboardCell
                        actual={row.actualCustomers}
                        target={row.targetCustomers}
                        percent={row.percentCustomers}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <LeaderboardCell
                        actual={row.actualUnits}
                        target={row.targetUnits}
                        percent={row.percentUnits}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <LeaderboardCell
                        actual={row.conversationsPerWeek}
                        target={row.conversationsTarget}
                        percent={row.conversationsPercent}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {teamOverview && (
        <TeamOverviewTable
          title={`Mijn team — ${teamOverview.teamName}`}
          members={teamOverview.members}
        />
      )}

      {allTeamOverviews && allTeamOverviews.length > 0 && activeTeam && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2 text-base">
            {allTeamOverviews.map((team) => (
              <Link
                key={team.teamId}
                href={`/dashboard?team=${team.teamId}`}
                className={`rounded-full px-4 py-1.5 ${
                  team.teamId === activeTeam.teamId
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                {team.teamName}
              </Link>
            ))}
          </div>
          <TeamOverviewTable
            title={`${activeTeam.teamName} — coach ${activeTeam.coachName}`}
            members={activeTeam.members}
          />
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
      <h2 className="mb-4 flex items-center gap-1.5 text-xl font-medium text-slate-900">
        <Users2 size={19} />
        {title}
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
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">
                  <div className="flex items-center gap-2">
                    <Avatar name={member.name} />
                    {member.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-700">{member.totalLeads}</td>
                <td className="px-6 py-4 text-slate-700">{member.won}</td>
                <td className="px-6 py-4">
                  <Badge variant={conversionBadgeVariant(member.conversionRate)}>
                    {member.conversionRate === null ? "—" : `${member.conversionRate}%`}
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
}: {
  label: string;
  actual: number;
  target: number;
  percent: number | null;
  icon: LucideIcon;
  percentPosition: "below" | "beside";
  percentSize?: string;
  accent: keyof typeof GOAL_CARD_ACCENTS;
}) {
  const accentClasses = GOAL_CARD_ACCENTS[accent];
  return (
    <div
      className={`rounded-xl border border-slate-200 ${accentClasses.border} bg-white p-6 shadow-sm`}
    >
      <span
        className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${accentClasses.icon}`}
      >
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
          className={`${percentSize} font-semibold ${percentColor(percent)} ${
            percentPosition === "below" ? "mt-1" : ""
          }`}
        >
          {percent === null ? "—" : `${percent}%`}
        </p>
      </div>
    </div>
  );
}

/** Compacte "behaald / doel · %"-weergave voor de mini-productietabel op het dashboard. */
function LeaderboardCell({
  actual,
  target,
  percent,
}: {
  actual: number;
  target: number;
  percent: number | null;
}) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-slate-900">{actual}</span>
      <span className="text-slate-400"> / {target || "—"}</span>
      {percent !== null && (
        <span className={`ml-1.5 font-medium ${percentColor(percent)}`}>
          {percent}%
        </span>
      )}
    </span>
  );
}
