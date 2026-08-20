"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder, canViewBeheerderTools } from "@/lib/permissions";

/** Logt een gebruiker geforceerd uit: hun huidige sessie wordt bij de eerstvolgende paginanavigatie ongeldig, ze moeten opnieuw via Google inloggen. Enkel de Beheerder mag dit. */
export async function forceLogoutUserAction(userId: string) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !isBeheerder(viewer)) {
    throw new Error("Enkel de Beheerder kan een sessie beëindigen");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { sessionInvalidatedAt: new Date() },
  });

  revalidatePath(`/beheer/gebruikers/${userId}`);
}

/**
 * Login-sessies van (een selectie van) gebruikers, nieuwste eerst — één rij
 * per keer dat iemand effectief via Google ingelogd is (zie de jwt-callback
 * in auth.ts). Zelfde toegang als het Logboek: Beheerder/Admin.
 */
export async function getLoginEvents(options?: {
  userId?: string;
  userIds?: string[];
}) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot de login-sessies");
  }

  return prisma.loginEvent.findMany({
    where: {
      ...(options?.userId
        ? { userId: options.userId }
        : options?.userIds
        ? { userId: { in: options.userIds } }
        : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
