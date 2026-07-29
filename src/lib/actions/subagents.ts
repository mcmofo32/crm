"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getEffectiveViewer } from "@/lib/impersonation";

async function requireUserManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om subagenten te beheren");
  }
  return viewer;
}

/** Alle subagenten, gebruikt om er één te kiezen bij het inplannen van een adviesgesprek. */
export async function getSubagents() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return prisma.subagent.findMany({
    include: { team: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createSubagentAction(teamId: string, formData: FormData) {
  const actor = await requireUserManager();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name || !email) {
    throw new Error("Naam en e-mail zijn verplicht");
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team niet gevonden");

  const subagent = await prisma.subagent.create({
    data: { name, email, phone, teamId },
  });

  await logAudit({
    actorId: actor.id,
    action: "subagent.created",
    entityType: "Subagent",
    entityId: subagent.id,
    description: `Subagent "${name}" toegevoegd aan team "${team.name}"`,
  });

  revalidatePath("/beheer/teams");
}

export async function deleteSubagentAction(subagentId: string) {
  const actor = await requireUserManager();

  const subagent = await prisma.subagent.findUnique({ where: { id: subagentId } });
  if (!subagent) throw new Error("Subagent niet gevonden");

  await prisma.subagent.delete({ where: { id: subagentId } });

  await logAudit({
    actorId: actor.id,
    action: "subagent.deleted",
    entityType: "Subagent",
    entityId: subagentId,
    description: `Subagent "${subagent.name}" verwijderd`,
  });

  revalidatePath("/beheer/teams");
}
