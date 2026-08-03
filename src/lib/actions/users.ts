"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { JobFunction, Role } from "@/generated/prisma/client";
import {
  canManageUser,
  canManageUsers,
  wouldCreateCoachCycle,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { getEffectiveViewer } from "@/lib/impersonation";

/** Vast tijdelijk wachtwoord voor nieuwe gebruikers; zij wijzigen dit zelf na de eerste login. */
const DEFAULT_TEMP_PASSWORD = "veranderditwachtwoord123";

/**
 * Vaste lijst i.p.v. Object.values(JobFunction): zo hangt validatie niet af
 * van hoe het gegenereerde Prisma-enum object in deze server-actionbundel
 * terechtkomt.
 */
const VALID_JOB_FUNCTIONS = new Set<string>([
  "FT1",
  "FT2",
  "FT3",
  "FTC",
  "FA",
  "FC",
  "DC",
  "RC",
  "NC",
]);

function parseJobFunction(raw: FormDataEntryValue | null): JobFunction | null {
  const value = String(raw ?? "");
  return VALID_JOB_FUNCTIONS.has(value) ? (value as JobFunction) : null;
}

async function requireUserManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om gebruikers te beheren");
  }
  return viewer;
}

/** Basisinfo van een gebruiker, voor bv. "wordt geplaatst onder X" op het nieuwe-gebruikerformulier. */
export async function getUserBasicInfo(userId: string) {
  await requireUserManager();
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
}

export async function createUserAction(formData: FormData) {
  const actor = await requireUserManager();

  const role = formData.get("role") as Role;
  if (!canManageUser(actor, { role })) {
    throw new Error("Je mag deze rol niet toekennen");
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const jobFunction = parseJobFunction(formData.get("jobFunction"));
  const isSubagent = formData.get("isSubagent") === "on";
  // Komt deze aanmaak vanuit "Nieuwe gebruiker toevoegen" naast iemands naam
  // op de Teams-pagina, dan wordt de nieuwe gebruiker meteen onder die
  // persoon geplaatst i.p.v. via de gewone team-dropdown hieronder.
  const underId = (formData.get("underId") as string) || null;
  const teamId = underId ? null : (formData.get("teamId") as string) || null;

  if (!name) {
    throw new Error("Naam is verplicht");
  }

  let underPerson = null;
  if (underId) {
    underPerson = await prisma.user.findUnique({
      where: { id: underId },
      include: { coachedTeam: true },
    });
    if (!underPerson) throw new Error("Gebruiker niet gevonden");
    if (!canManageUser(actor, underPerson)) {
      throw new Error("Je mag deze gebruiker niet beheren");
    }
  }

  const passwordHash = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      role,
      jobFunction,
      isSubagent,
      // Elke rol kan lid zijn van een team (ook Beheerder/Admin), zodat
      // iedereen ergens in de organigram-structuur kan hangen.
      teamId,
    },
  });

  if (role === Role.COACH) {
    await prisma.team.create({
      data: { name: `Team ${name}`, coachId: user.id },
    });
  }

  if (underPerson) {
    let team = underPerson.coachedTeam;
    if (!team) {
      const [newTeam] = await prisma.$transaction([
        prisma.team.create({
          data: { name: `Team ${underPerson.name}`, coachId: underPerson.id },
        }),
        prisma.user.update({
          where: { id: underPerson.id },
          data: { role: Role.COACH },
        }),
      ]);
      team = newTeam;
    }
    await prisma.user.update({ where: { id: user.id }, data: { teamId: team.id } });
  }

  await logAudit({
    actorId: actor.id,
    action: "user.created",
    entityType: "User",
    entityId: user.id,
    description: underPerson
      ? `Gebruiker "${name}" aangemaakt (${ROLE_LABELS[role]}) onder "${underPerson.name}"`
      : `Gebruiker "${name}" aangemaakt (${ROLE_LABELS[role]})`,
  });

  revalidatePath("/beheer/gebruikers");
  revalidatePath("/beheer/teams");
  revalidatePath("/organigram");
  redirect(underPerson ? "/beheer/teams" : "/beheer/gebruikers");
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
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const teamId = (formData.get("teamId") as string) || null;
  const jobFunction = parseJobFunction(formData.get("jobFunction"));
  const isSubagent = formData.get("isSubagent") === "on";

  if (!name || !email) {
    throw new Error("Naam en e-mail zijn verplicht");
  }

  if (role === Role.COACH && teamId) {
    const targetTeam = await prisma.team.findUnique({ where: { id: teamId } });
    if (targetTeam && (await wouldCreateCoachCycle(userId, targetTeam.coachId))) {
      throw new Error(
        "Dit zou een cirkel in de structuur veroorzaken (deze coach zit al boven de coach van dit team)"
      );
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      name,
      email,
      phone,
      role,
      jobFunction,
      isSubagent,
      // Elke rol kan lid zijn van een team (ook Beheerder/Admin), zodat
      // iedereen ergens in de organigram-structuur kan hangen.
      teamId,
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
  revalidatePath("/organigram");
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
