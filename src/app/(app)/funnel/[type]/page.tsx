import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getVisibleUserIds } from "@/lib/permissions";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";
import { FunnelBoard } from "@/components/FunnelBoard";
import { getSubagents } from "@/lib/actions/subagents";

export default async function FunnelPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const leadType = type.toUpperCase();
  if (leadType !== "FA" && leadType !== "RG") notFound();

  const user = (await getEffectiveViewer())!;
  const visibleUserIds = await getVisibleUserIds(user);

  const stages = await prisma.funnelStage.findMany({
    where: { leadType: leadType as LeadType },
    orderBy: { order: "asc" },
    include: {
      leads: {
        where: {
          deletedAt: null,
          ...(visibleUserIds ? { ownerId: { in: visibleUserIds } } : {}),
        },
        include: {
          owner: true,
          activities: {
            where: { status: "PLANNED", scheduledAt: { gte: new Date() } },
            orderBy: { scheduledAt: "asc" },
            take: 1,
            select: { scheduledAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const subagents = await getSubagents();

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
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-base font-medium text-white hover:bg-slate-800"
        >
          <Plus size={17} />
          Nieuwe lead
        </Link>
      </div>

      <p className="-mt-2 text-sm text-slate-400">
        Sleep een lead naar een andere kolom om de fase te wijzigen.
      </p>

      <FunnelBoard stages={stages} leadType={leadType} subagents={subagents} />
    </div>
  );
}
