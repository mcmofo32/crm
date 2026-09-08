"use server";

import { cache } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgentType, Role } from "@/generated/prisma/client";

const VIEW_AS_COOKIE = "view-as-role";
const VIEW_AS_USER_COOKIE = "view-as-user-id";

const VIEWABLE_ROLES = [Role.ADMIN, Role.COACH, Role.USER] as const;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 8,
};

export type EffectiveViewer = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Het echte, geauthenticeerde account-id — nooit overschreven. Enkel bij een volledige medewerker-wissel (setViewAsUserAction) wijkt id hiervan af; bij een rol-voorbeeld (setViewAsRoleAction) blijft id gelijk aan realId. */
  realId: string;
  /** De echte, geauthenticeerde rol — nooit overschreven, enkel gebruikt om impersonation toe te staan/tonen. */
  realRole: Role;
  isImpersonating: boolean;
  /** Analyst (standaard) of subagent — bepaalt o.a. of deze gebruiker leads als klant mag afsluiten. */
  agentType: AgentType;
  /** Geeft toegang tot het Management-tabblad in de Bibliotheek. */
  isManagement: boolean;
};

function isViewableRole(value: string | undefined): value is Role {
  return !!value && (VIEWABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Haalt de rol/naam/actief-status altijd vers uit de database i.p.v. te
 * vertrouwen op het JWT-sessietoken. Dat token wordt enkel bij het inloggen
 * gevuld, dus zonder deze verse check zou een rolwijziging of deactivatie
 * pas na uit-/opnieuw inloggen doorwerken — een gedeactiveerde gebruiker zou
 * dan met een lopende sessie gewoon toegang houden. `null` = niet (meer)
 * ingelogd, ook als het account intussen gedeactiveerd is, of als de
 * Beheerder deze sessie geforceerd heeft uitgelogd (zie sessions.ts).
 */
const getFreshSessionUser = cache(async function getFreshSessionUser() {
  const session = await auth();
  if (!session?.user) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      agentType: true,
      isManagement: true,
      sessionInvalidatedAt: true,
    },
  });
  if (!dbUser || !dbUser.active) return null;
  if (
    dbUser.sessionInvalidatedAt &&
    dbUser.sessionInvalidatedAt.getTime() > session.user.loginAt
  ) {
    return null;
  }

  return dbUser;
});

/**
 * Geeft de "effectieve" gebruiker voor read-only weergave. Enkel voor de
 * echte Beheerder kan één van twee "bekijk als"-cookies dit overschrijven:
 * - view-as-user-id: volledige identiteitswissel (id/naam/rol/...) naar één
 *   specifieke, actieve medewerker — voor gerichte support/troubleshooting
 *   (zie setViewAsUserAction), want zo tonen ook persoonlijke pagina's als
 *   Instellingen (Zoom-link, Google Agenda-koppeling) diens eigen gegevens.
 * - view-as-role: enkel de rol wisselt, id/naam/... blijven van de
 *   Beheerder zelf — een lichtere "voorbeeldweergave" om rechten te testen.
 * De user-cookie heeft voorrang als beide ooit tegelijk zouden staan.
 */
export const getEffectiveViewer = cache(
  async (): Promise<EffectiveViewer | null> => {
    const dbUser = await getFreshSessionUser();
    if (!dbUser) return null;

    const realRole = dbUser.role;
    const cookieStore = await cookies();

    if (realRole === Role.BEHEERDER) {
      const viewAsUserId = cookieStore.get(VIEW_AS_USER_COOKIE)?.value;
      if (viewAsUserId) {
        const target = await prisma.user.findUnique({
          where: { id: viewAsUserId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            agentType: true,
            isManagement: true,
          },
        });
        // Ongeldig of intussen gedeactiveerd doelwit: geruisloos terugvallen
        // op de rol-cookie/eigen identiteit, i.p.v. crashen.
        if (target?.active) {
          return {
            id: target.id,
            name: target.name,
            email: target.email ?? "",
            role: target.role,
            realId: dbUser.id,
            realRole,
            isImpersonating: true,
            agentType: target.agentType,
            isManagement: target.isManagement,
          };
        }
      }
    }

    const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value;
    const role =
      realRole === Role.BEHEERDER && isViewableRole(viewAs) ? viewAs : realRole;

    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email ?? "",
      role,
      realId: dbUser.id,
      realRole,
      isImpersonating: role !== realRole,
      agentType: dbUser.agentType,
      isManagement: dbUser.isManagement,
    };
  }
);

export async function setViewAsRoleAction(role: Role) {
  const dbUser = await getFreshSessionUser();
  if (!dbUser || dbUser.role !== Role.BEHEERDER) {
    throw new Error("Enkel de Beheerder kan zich voordoen als een andere rol");
  }
  if (!isViewableRole(role)) {
    throw new Error("Ongeldige rol");
  }

  const cookieStore = await cookies();
  // De twee "bekijk als"-standen sluiten elkaar uit.
  cookieStore.delete(VIEW_AS_USER_COOKIE);
  cookieStore.set(VIEW_AS_COOKIE, role, COOKIE_OPTIONS);
}

/**
 * Volledige identiteitswissel naar één specifieke, actieve medewerker —
 * voor gericht support/troubleshooting (bv. diens Google Agenda-koppeling
 * of Zoom-link bekijken/aanpassen op Instellingen). Anders dan
 * setViewAsRoleAction (enkel een rol-voorbeeld) worden hierna ook acties
 * die je uitvoert effectief aan deze medewerker toegeschreven — de balk
 * bovenaan blijft dit altijd tonen zolang dit actief staat.
 */
export async function setViewAsUserAction(
  userId: string
): Promise<{ error: string } | undefined> {
  const dbUser = await getFreshSessionUser();
  if (!dbUser || dbUser.role !== Role.BEHEERDER) {
    return { error: "Enkel de Beheerder kan de CRM als een medewerker bekijken" };
  }
  if (userId === dbUser.id) {
    return { error: "Je bekijkt de CRM al als jezelf" };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { active: true },
  });
  if (!target?.active) {
    return { error: "Medewerker niet gevonden of niet actief" };
  }

  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  cookieStore.set(VIEW_AS_USER_COOKIE, userId, COOKIE_OPTIONS);
}

export async function clearViewAsRoleAction() {
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
  cookieStore.delete(VIEW_AS_USER_COOKIE);
}
