import { prisma } from "@/lib/prisma";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";

export async function getAuditLog(entityType?: string) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot het logboek");
  }

  return prisma.auditLog.findMany({
    where: entityType ? { entityType } : {},
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  description,
}: {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
}) {
  await prisma.auditLog.create({
    data: { actorId, action, entityType, entityId, description },
  });
}
