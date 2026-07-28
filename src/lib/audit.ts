import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBeheerder } from "@/lib/permissions";

export async function getAuditLog(entityType?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  if (!isBeheerder(session.user)) {
    throw new Error("Enkel de Beheerder heeft toegang tot het logboek");
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
