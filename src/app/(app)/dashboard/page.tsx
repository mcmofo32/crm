import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleUserIds } from "@/lib/permissions";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import { LeadStatus, LeadType } from "@/generated/prisma/client";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const ids = await getVisibleUserIds(user);
  const ownerWhere = ids ? { ownerId: { in: ids } } : {};

  const [openFA, openRG, wonCount, upcomingCalls] = await Promise.all([
    prisma.lead.count({
      where: { ...ownerWhere, leadType: LeadType.FA, status: LeadStatus.OPEN },
    }),
    prisma.lead.count({
      where: { ...ownerWhere, leadType: LeadType.RG, status: LeadStatus.OPEN },
    }),
    prisma.lead.count({ where: { ...ownerWhere, status: LeadStatus.WON } }),
    prisma.activity.findMany({
      where: {
        status: "PLANNED",
        scheduledAt: { gte: new Date() },
        lead: ownerWhere,
      },
      include: { lead: true },
      orderBy: { scheduledAt: "asc" },
      take: 8,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welkom, {user.name}
        </h1>
        <p className="text-sm text-slate-500">
          Hier is een overzicht van je leads en geplande opvolging.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={`Open — ${LEAD_TYPE_LABELS.FA}`}
          value={openFA}
          href="/funnel/FA"
        />
        <StatCard
          label={`Open — ${LEAD_TYPE_LABELS.RG}`}
          value={openRG}
          href="/funnel/RG"
        />
        <StatCard label="Gewonnen leads" value={wonCount} href="/leads" />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Geplande gesprekken
        </h2>
        {upcomingCalls.length === 0 ? (
          <p className="text-sm text-slate-500">
            Geen geplande activiteiten.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {upcomingCalls.map((activity) => (
              <li
                key={activity.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <Link
                    href={`/leads/${activity.leadId}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {activity.subject}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {activity.lead.firstName} {activity.lead.lastName}
                  </p>
                </div>
                <span className="text-sm text-slate-500">
                  {activity.scheduledAt?.toLocaleString("nl-BE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Link>
  );
}
