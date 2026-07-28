"use server";

import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { Role } from "@/generated/prisma/client";

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
};

function isViewableRole(value: string | undefined): value is Role {
  return !!value && (VIEWABLE_ROLES as readonly string[]).includes(value);
}

/**
 * Geeft de "effectieve" gebruiker voor read-only weergave: als de echt
 * ingelogde gebruiker Beheerder is EN er een "bekijk als"-cookie staat,
 * wordt de rol daarvoor vervangen. Voor elke andere rol wordt de cookie
 * genegeerd — enkel de Beheerder kan zichzelf ooit een lagere rol geven,
 * nooit omgekeerd.
 */
export async function getEffectiveViewer(): Promise<EffectiveViewer | null> {
  const session = await auth();
  if (!session?.user) return null;

  const realRole = session.user.role;
  const cookieStore = await cookies();
  const viewAs = cookieStore.get(VIEW_AS_COOKIE)?.value;

  const role =
    realRole === Role.BEHEERDER && isViewableRole(viewAs) ? viewAs : realRole;

  return {
    id: session.user.id,
    name: session.user.name ?? "?",
    email: session.user.email ?? "",
    role,
    realRole,
    isImpersonating: role !== realRole,
  };
}

export async function setViewAsRoleAction(role: Role) {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.BEHEERDER) {
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
