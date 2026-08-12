"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder } from "@/lib/permissions";

async function requireBeheerder() {
  const viewer = await getEffectiveViewer();
  if (!viewer || !isBeheerder(viewer)) {
    throw new Error("Enkel de Beheerder heeft toegang tot actieve sessies");
  }
  return viewer;
}

/** Sessies (JWT, 30 dagen geldig) verlopen vanzelf na deze duur — gebruikt om "nog ingelogd" te bepalen. */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  lastLoginAt: Date | null;
  loggedIn: boolean;
};

/**
 * Alle actieve gebruikers met hun laatste Google-login en of die sessie nog
 * geldig is — "geldig" betekent hier: ooit ingelogd, niet nadien geforceerd
 * uitgelogd, en binnen de 30 dagen sessieduur. Er is geen live
 * verbindingenlijst (JWT-sessies laten geen server-side overzicht toe van
 * wie op dit moment actief aan het klikken is), dit is het dichtste
 * benaderbare equivalent.
 */
export async function getActiveSessions(): Promise<SessionRow[]> {
  await requireBeheerder();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      lastLoginAt: true,
      sessionInvalidatedAt: true,
    },
    orderBy: { lastLoginAt: "desc" },
  });

  const now = Date.now();
  return users.map((u) => {
    const loggedIn = Boolean(
      u.lastLoginAt &&
        now - u.lastLoginAt.getTime() < SESSION_MAX_AGE_MS &&
        (!u.sessionInvalidatedAt || u.sessionInvalidatedAt < u.lastLoginAt)
    );
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      lastLoginAt: u.lastLoginAt,
      loggedIn,
    };
  });
}

/** Logt een gebruiker geforceerd uit: hun huidige sessie wordt bij de eerstvolgende paginanavigatie ongeldig, ze moeten opnieuw via Google inloggen. */
export async function forceLogoutUserAction(userId: string) {
  await requireBeheerder();

  await prisma.user.update({
    where: { id: userId },
    data: { sessionInvalidatedAt: new Date() },
  });

  revalidatePath("/beheer/sessies");
}
