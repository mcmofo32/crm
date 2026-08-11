"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AgentType, JobFunction, Role } from "@/generated/prisma/client";
import {
  canManageUser,
  canManageUsers,
  wouldCreateCoachCycle,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { ROLE_LABELS } from "@/lib/roleLabels";
import { getEffectiveViewer } from "@/lib/impersonation";
import { syncSubagentForUser } from "@/lib/actions/subagents";

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

/**
 * Letterlijke strings i.p.v. AgentType.SUBAGENT/ANALYST: dezelfde reden als
 * bij VALID_JOB_FUNCTIONS hierboven — een property-lookup op het
 * gegenereerde enum-object bleek in deze server-actionbundel niet
 * betrouwbaar, waardoor de waarde stilzwijgend nooit veranderde (Prisma
 * negeert een `undefined` veld bij een update i.p.v. een fout te geven).
 */
function parseAgentType(raw: FormDataEntryValue | null): AgentType {
  return (String(raw ?? "") === "SUBAGENT" ? "SUBAGENT" : "ANALYST") as AgentType;
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
  const agentType = parseAgentType(formData.get("agentType"));
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

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      role,
      jobFunction,
      agentType,
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
      // Enkel een gewone USER wordt hier automatisch Coach; een Admin/
      // Beheerder die nog geen eigen team had, behoudt zijn rol.
      if (underPerson.role === Role.USER) {
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
      } else {
        team = await prisma.team.create({
          data: { name: `Team ${underPerson.name}`, coachId: underPerson.id },
        });
      }
    }
    await prisma.user.update({ where: { id: user.id }, data: { teamId: team.id } });
  }

  await syncSubagentForUser(user.id);

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
  await syncSubagentForUser(userId);

  await logAudit({
    actorId: actor.id,
    action: active ? "user.activated" : "user.deactivated",
    entityType: "User",
    entityId: target.id,
    description: `Gebruiker "${target.name}" ${active ? "geactiveerd" : "gedeactiveerd"}`,
  });

  revalidatePath("/beheer/gebruikers");
  revalidatePath("/organigram");
  revalidatePath("/beheer/teams");
}

export async function getManageableUsers() {
  const actor = await requireUserManager();
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: { team: true, coachedTeam: true },
    orderBy: { createdAt: "asc" },
  });
  return actor.role === Role.BEHEERDER
    ? users
    : users.filter((u) => u.role !== Role.BEHEERDER && u.role !== Role.ADMIN);
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
  if (!target || target.deletedAt || !canManageUser(actor, target)) return null;
  return target;
}

export type UpdateUserState = { error?: string } | null;

/**
 * Geeft fouten terug als state i.p.v. te throwen: Next.js redact in productie
 * de boodschap van elke fout die tijdens een server-actie/render gegooid
 * wordt (enkel een digest blijft over), dus een throw hier kwam nooit
 * zichtbaar bij de gebruiker terecht. Via useActionState (zie EditUserForm)
 * krijgt de gebruiker de effectieve foutmelding wel te zien.
 */
export async function updateUserAction(
  userId: string,
  _prevState: UpdateUserState,
  formData: FormData
): Promise<UpdateUserState> {
  try {
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
    // Enkel USER heeft geen eigen zicht op een team (getVisibleUserIds geeft
    // enkel zichzelf terug); Admin/Beheerder zien toch alles, dus die mogen
    // een team blijven coachen ook al is hun rol niet (meer) Coach.
    if (target.role === Role.COACH && role === Role.USER && target.coachedTeam) {
      throw new Error(
        "Deze coach heeft nog een team. Verwijder of herverdeel het team eerst."
      );
    }

    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const phone = String(formData.get("phone") ?? "").trim() || null;
    const teamId = (formData.get("teamId") as string) || null;
    const jobFunction = parseJobFunction(formData.get("jobFunction"));
    const agentType = parseAgentType(formData.get("agentType"));

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
        agentType,
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

    await syncSubagentForUser(userId);

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
    revalidatePath("/beheer/teams");
    return null;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Er ging iets mis. Probeer opnieuw.",
    };
  }
}

/** Hoeveel klanten/leads deze gebruiker nog bezit/beheert — getoond op het verwijderformulier, waar overzetten optioneel is. */
export async function getUserDeletionImpact(userId: string) {
  await requireUserManager();
  const [ownedLeadsCount, caseManagedLeadsCount, coachedTeam] = await Promise.all([
    prisma.lead.count({ where: { ownerId: userId, deletedAt: null } }),
    prisma.lead.count({ where: { caseManagerUserId: userId, deletedAt: null } }),
    prisma.team.findUnique({ where: { coachId: userId }, select: { id: true } }),
  ]);
  return {
    ownedLeadsCount,
    caseManagedLeadsCount,
    coachesTeam: coachedTeam !== null,
  };
}

/** Kandidaten om leads/dossiers van een te verwijderen gebruiker aan over te dragen. */
export async function getReassignableUsers(excludeUserId: string) {
  await requireUserManager();
  return prisma.user.findMany({
    where: { id: { not: excludeUserId }, active: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Verwijdert een gebruiker (soft delete): het account zelf en alle historiek
 * die ernaar verwijst (activiteiten, audit log, ...) blijven gewoon bestaan,
 * maar de gebruiker kan niet meer inloggen en verdwijnt uit alle
 * keuzelijsten. Klanten/leads die deze gebruiker nog bezat of als
 * dossierbeheerder had, worden — indien `newOwnerId` meegegeven wordt —
 * overgezet; dat is optioneel, want de leads zelf blijven hoe dan ook
 * gewoon in de database bestaan (enkel bij de verwijderde gebruiker).
 */
export async function deleteUserAction(userId: string, newOwnerId: string | null) {
  const actor = await requireUserManager();
  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { coachedTeam: true },
  });
  if (!target) throw new Error("Gebruiker niet gevonden");
  if (target.deletedAt) throw new Error("Deze gebruiker is al verwijderd");
  if (!canManageUser(actor, target)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }
  if (target.id === actor.id) {
    throw new Error("Je kan je eigen account niet verwijderen");
  }
  if (target.coachedTeam) {
    throw new Error(
      "Deze gebruiker coacht nog een team. Verwijder of herverdeel het team eerst."
    );
  }

  let newOwner = null;
  if (newOwnerId) {
    if (newOwnerId === userId) {
      throw new Error("Kies een andere gebruiker om de klanten aan over te dragen.");
    }
    newOwner = await prisma.user.findUnique({ where: { id: newOwnerId } });
    if (!newOwner || newOwner.deletedAt) {
      throw new Error("Gekozen nieuwe eigenaar niet gevonden");
    }
  }

  const [ownedLeads, caseManagedLeads] = newOwnerId
    ? await Promise.all([
        prisma.lead.findMany({
          where: { ownerId: userId, deletedAt: null },
          select: { id: true },
        }),
        prisma.lead.findMany({
          where: { caseManagerUserId: userId, deletedAt: null },
          select: { id: true },
        }),
      ])
    : [[], []];

  await prisma.$transaction([
    ...(ownedLeads.length > 0
      ? [
          prisma.lead.updateMany({
            where: { ownerId: userId, deletedAt: null },
            data: { ownerId: newOwnerId! },
          }),
        ]
      : []),
    ...(caseManagedLeads.length > 0
      ? [
          prisma.lead.updateMany({
            where: { caseManagerUserId: userId, deletedAt: null },
            data: { caseManagerUserId: newOwnerId! },
          }),
        ]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: { active: false, deletedAt: new Date() },
    }),
  ]);

  await syncSubagentForUser(userId);

  await logAudit({
    actorId: actor.id,
    action: "user.deleted",
    entityType: "User",
    entityId: target.id,
    description: newOwner
      ? `Gebruiker "${target.name}" verwijderd — ${ownedLeads.length} eigen lead(en) en ${caseManagedLeads.length} dossier(s) overgezet naar "${newOwner.name}"`
      : `Gebruiker "${target.name}" verwijderd`,
  });

  revalidatePath("/beheer/gebruikers");
  revalidatePath("/organigram");
  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/doelen");
  revalidatePath("/productie");
}
