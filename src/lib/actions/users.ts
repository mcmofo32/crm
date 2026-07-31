"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { canManageUser, canManageUsers } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { getEffectiveViewer } from "@/lib/impersonation";

/** Vast tijdelijk wachtwoord voor nieuwe gebruikers; zij wijzigen dit zelf na de eerste login. */
const DEFAULT_TEMP_PASSWORD = "veranderditwachtwoord123";

async function requireUserManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om gebruikers te beheren");
  }
  return viewer;
}

export async function createUserAction(formData: FormData) {
  const actor = await requireUserManager();

  const role = formData.get("role") as Role;
  if (!canManageUser(actor, { role })) {
    throw new Error("Je mag deze rol niet toekennen");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const teamId = (formData.get("teamId") as string) || null;

  if (!name) {
    throw new Error("Naam is verplicht");
  }

  const passwordHash = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      teamId: role === Role.USER ? teamId : null,
    },
  });

  if (role === Role.COACH) {
    await prisma.team.create({
      data: { name: `Team ${name}`, coachId: user.id },
    });
  }

  await logAudit({
    actorId: actor.id,
    action: "user.created",
    entityType: "User",
    entityId: user.id,
    description: `Gebruiker "${name}" aangemaakt (${ROLE_LABELS[role]})`,
  });

  revalidatePath("/beheer/gebruikers");
  redirect("/beheer/gebruikers");
}

export async function setUserActiveAction(userId: string, active: boolean) {
  const actor = await requireUserManager();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Gebruiker niet gevonden");
  if (!canManageUser(actor, target)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });

  await logAudit({
    actorId: actor.id,
    action: active ? "user.activated" : "user.deactivated",
    entityType: "User",
    entityId: target.id,
    description: `Gebruiker "${target.name}" ${active ? "geactiveerd" : "gedeactiveerd"}`,
  });

  revalidatePath("/beheer/gebruikers");
}

export async function getManageableUsers() {
  const actor = await requireUserManager();
  const users = await prisma.user.findMany({
    include: { team: true, coachedTeam: true },
    orderBy: { createdAt: "asc" },
  });
  return actor.role === Role.BEHEERDER
    ? users
    : users.filter((u) => u.role !== Role.BEHEERDER);
}

export async function getTeamsForAssignment() {
  await requireUserManager();
  return prisma.team.findMany({
    include: { coach: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getUserForEdit(userId: string) {
  const actor = await requireUserManager();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || !canManageUser(actor, target)) return null;
  return target;
}

export async function updateUserAction(userId: string, formData: FormData) {
  const actor = await requireUserManager();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { coachedTeam: true },
  });
  if (!target) throw new Error("Gebruiker niet gevonden");
  if (!canManageUser(actor, target)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }

  const role = formData.get("role") as Role;
  if (!canManageUser(actor, { role })) {
    throw new Error("Je mag deze rol niet toekennen");
  }
  if (target.role === Role.COACH && role !== Role.COACH && target.coachedTeam) {
    throw new Error(
      "Deze coach heeft nog een team. Verwijder of herverdeel het team eerst."
    );
  }

  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const teamId = (formData.get("teamId") as string) || null;

  if (!name || !email) {
    throw new Error("Naam en e-mail zijn verplicht");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      role,
      teamId: role === Role.USER ? teamId : null,
    },
  });

  if (role === Role.COACH && !target.coachedTeam) {
    await prisma.team.create({
      data: { name: `Team ${name}`, coachId: userId },
    });
  }

  const changes: string[] = [];
  if (target.name !== name) changes.push(`naam: "${target.name}" → "${name}"`);
  if (target.email !== email) changes.push(`e-mail: "${target.email}" → "${email}"`);
  if (target.role !== role) {
    changes.push(`rol: ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[role]}`);
  }
  if (changes.length > 0) {
    await logAudit({
      actorId: actor.id,
      action: "user.updated",
      entityType: "User",
      entityId: userId,
      description: `Gebruiker "${target.name}" gewijzigd (${changes.join(", ")})`,
    });
  }

  revalidatePath("/beheer/gebruikers");
  revalidatePath(`/beheer/gebruikers/${userId}`);
}

export async function resetUserPasswordAction(
  userId: string,
  formData: FormData
) {
  const actor = await requireUserManager();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new Error("Gebruiker niet gevonden");
  if (!canManageUser(actor, target)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }

  const password = String(formData.get("password") ?? "");
  if (password.length < 8) {
    throw new Error("Wachtwoord moet minstens 8 tekens hebben");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await logAudit({
    actorId: actor.id,
    action: "user.password_reset",
    entityType: "User",
    entityId: target.id,
    description: `Wachtwoord gereset voor gebruiker "${target.name}"`,
  });

  revalidatePath(`/beheer/gebruikers/${userId}`);
}
