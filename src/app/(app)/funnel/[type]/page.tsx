import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getVisibleUserIds } from "@/lib/permissions";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";
import { StageSelect } from "../../leads/[id]/StageSelect";

export default async function FunnelPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const leadType = type.toUpperCase();
  if (leadType !== "FA" && leadType !== "RG") notFound();

  const session = await auth();
  const user = session!.user;
  const visibleUserIds = await getVisibleUserIds(user);

  const stages = await prisma.funnelStage.findMany({
    where: { leadType: leadType as LeadType },
    orderBy: { order: "asc" },
    include: {
      leads: {
        where: visibleUserIds ? { ownerId: { in: visibleUserIds } } : {},
        include: { owner: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (stages.length === 0) {
    return (
      <p className="text-base text-slate-500">
        Er zijn nog geen funnel-stages geconfigureerd voor{" "}
        {LEAD_TYPE_LABELS[leadType]}.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">
          {LEAD_TYPE_LABELS[leadType]} — funnel
        </h1>
        <Link
          href="/leads/new"
          className="rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
        >
          Nieuwe lead
        </Link>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex w-80 flex-shrink-0 flex-col gap-3 rounded-lg bg-slate-100 p-4"
          >
            <div className="flex items-center justify-between px-1">
              <span
                className="text-base font-semibold"
                style={{ color: stage.color }}
              >
                {stage.label}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-sm text-slate-500">
                {stage.leads.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {stage.leads.map((lead) => (
                <div
                  key={lead.id}
                  className="rounded-md border border-slate-200 bg-white p-4 text-base shadow-sm"
                >
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {lead.firstName} {lead.lastName}
                  </Link>
                  {lead.company && (
                    <p className="text-sm text-slate-400">{lead.company}</p>
                  )}
                  <p className="mb-2 text-sm text-slate-400">
                    {lead.owner.name}
                  </p>
                  <StageSelect
                    leadId={lead.id}
                    currentStageId={lead.stageId}
                    stages={stages}
                  />
                </div>
              ))}
              {stage.leads.length === 0 && (
                <p className="px-1 text-sm text-slate-400">Geen leads</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
