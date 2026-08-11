"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgentType, Role } from "@/generated/prisma/client";

const VIEW_AS_COOKIE = "view-as-role";

const VIEWABLE_ROLES = [Role.ADMIN, Role.COACH, Role.USER] as const;

export type EffectiveViewer = {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** De echte, geauthenticeerde rol — nooit overschreven, enkel gebruikt om impersonation toe te staan/tonen. */
  realRole: Role;
  isImpersonating: boolean;
  /** Analyst (standaard) of subagent — bepaalt o.a. of deze gebruiker leads als klant mag afsluiten. */
  agentType: AgentType;
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
 * ingelogd, ook als het account intussen gedeactiveerd is.
 */
async function getFreshSessionUser() {
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
    },
  });
  if (!dbUser || !dbUser.active) return null;

  return dbUser;
}

/**
 * Geeft de "effectieve" gebruiker voor read-only weergave: als de echt
 * ingelogde gebruiker Beheerder is EN er een "bekijk als"-cookie staat,
 * wordt de rol daarvoor vervangen. Voor elke andere rol wordt de cookie
 * genegeerd — enkel de Beheerder kan zichzelf ooit een lagere rol geven,
 * nooit omgekeerd.
 */
export async function getEffectiveViewer(): Promise<EffectiveViewer | null> {
  const dbUser = await getFreshSessionUser();
  if (!dbUser) return null;

  const realRole = dbUser.role;
  const cookieStore = await cookies();
  const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value;

  const role =
    realRole === Role.BEHEERDER && isViewableRole(viewAs) ? viewAs : realRole;

  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email ?? "",
    role,
    realRole,
    isImpersonating: role !== realRole,
    agentType: dbUser.agentType,
  };
}

export async function setViewAsRoleAction(role: Role) {
  const dbUser = await getFreshSessionUser();
  if (!dbUser || dbUser.role !== Role.BEHEERDER) {
    throw new Error("Enkel de Beheerder kan zich voordoen als een andere rol");
  }
  if (!isViewableRole(role)) {
    throw new Error("Ongeldige rol");
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEW_AS_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearViewAsRoleAction() {
  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);
}
