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

/** Na zoveel inactiviteit start een nieuwe sessie i.p.v. de bestaande bij te werken. */
const SESSION_GAP_MS = 30 * 60 * 1000;
/** Binnen een sessie wordt lastSeenAt hoogstens dit vaak weggeschreven — anders zou elke paginanavigatie een write vergen. */
const TOUCH_THROTTLE_MS = 60 * 1000;

/**
 * Registreert dat deze gebruiker zonet actief was in de CRM — aangeroepen
 * vanuit de layout, dus bij elke paginanavigatie (niet enkel bij het
 * inloggen zelf). Groepeert opeenvolgende activiteit in "sessies": zolang
 * de vorige activiteit van deze gebruiker minder dan SESSION_GAP_MS geleden
 * was, wordt gewoon lastSeenAt van die sessie bijgewerkt (maximaal eens per
 * TOUCH_THROTTLE_MS); pas na een langere stilte start een nieuwe sessie.
 */
export async function touchLoginActivity(userId: string) {
  const now = new Date();
  const latest = await prisma.loginEvent.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (latest && now.getTime() - latest.lastSeenAt.getTime() < SESSION_GAP_MS) {
    if (now.getTime() - latest.lastSeenAt.getTime() >= TOUCH_THROTTLE_MS) {
      await prisma.loginEvent.update({
        where: { id: latest.id },
        data: { lastSeenAt: now },
      });
    }
    return;
  }

  await prisma.loginEvent.create({ data: { userId, lastSeenAt: now } });
}

/**
 * Login-sessies van (een selectie van) gebruikers, nieuwste eerst — zie
 * touchLoginActivity hierboven voor wat een "sessie" precies is. Zelfde
 * toegang als het Logboek: Beheerder/Admin.
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
