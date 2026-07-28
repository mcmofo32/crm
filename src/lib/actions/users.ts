"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { canManageUser, canManageUsers } from "@/lib/permissions";

async function requireUserManager() {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  if (!canManageUsers(session.user)) {
    throw new Error("Je hebt geen rechten om gebruikers te beheren");
  }
  return session.user;
}

export async function createUserAction(formData: FormData) {
  const actor = await requireUserManager();

  const role = formData.get("role") as Role;
  if (!canManageUser(actor, { role })) {
    throw new Error("Je mag deze rol niet toekennen");
  }

  const name = String(formData.get("name") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const teamId = (formData.get("teamId") as string) || null;

  if (!name || !email || password.length < 8) {
    throw new Error(
      "Naam en e-mail zijn verplicht, wachtwoord moet minstens 8 tekens hebben"
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

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

  revalidatePath(`/beheer/gebruikers/${userId}`);
}
