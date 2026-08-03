import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";
import { LEAD_TYPE_LABELS } from "@/lib/roleLabels";
import { LeadType, Role } from "@/generated/prisma/client";
import { FunnelBoard } from "@/components/FunnelBoard";
import { getSubagents } from "@/lib/actions/subagents";
import { ensureFunnelStages, funnelStageKeys } from "@/lib/funnelStages";

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ ownerId?: string }>;
}) {
  const { type } = await params;
  const { ownerId } = await searchParams;
  const leadType = type.toUpperCase();
  if (leadType !== "FA" && leadType !== "RG") notFound();

  const user = (await getEffectiveViewer())!;
  await ensureFunnelStages(leadType as LeadType);
  const [assignableUsers, subagents] = await Promise.all([
    getAssignableUsers(),
    getSubagents(),
  ]);
  // Coach ziet de balk altijd (ook met een klein/leeg team), zodat duidelijk
  // is dat hij enkel toegang heeft tot zichzelf + zijn teamleden.
  const requiresSelection =
    assignableUsers.length > 1 || user.role === Role.COACH;
  const selectedOwnerId =
    ownerId && assignableUsers.some((u) => u.id === ownerId)
      ? ownerId
      : user.id;

  const ownerSwitcher = requiresSelection && (
    <form
      method="GET"
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
    >
      <Users size={17} className="text-slate-400" />
      <label className="text-sm text-slate-600">Bekijk funnel van:</label>
      <select
        name="ownerId"
        defaultValue={selectedOwnerId}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {assignableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.id === user.id ? `${u.name} (jezelf)` : u.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Bekijken
      </button>
    </form>
  );

  // Enkel de velden selecteren die FunnelBoard effectief tekent (bv. geen
  // notities, geen volledige owner-rij) — dat scheelt zowel databasewerk als
  // de hoeveelheid data die naar de client geserialiseerd moet worden.
  const stages = await prisma.funnelStage.findMany({
    where: {
      leadType: leadType as LeadType,
      key: { in: funnelStageKeys(leadType as LeadType) },
    },
    orderBy: { order: "asc" },
    select: {
      id: true,
      key: true,
      label: true,
      order: true,
      isWon: true,
      isLost: true,
      leads: {
        where: {
          deletedAt: null,
          ownerId: selectedOwnerId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          source: true,
          company: true,
          stageId: true,
          lastContactedAt: true,
          owner: { select: { name: true } },
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

      {ownerSwitcher}

      <p className="-mt-2 text-sm text-slate-400">
        Sleep een lead naar een andere kolom om de fase te wijzigen.
      </p>

      <FunnelBoard stages={stages} leadType={leadType} subagents={subagents} />
    </div>
  );
}
