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

export type UserLoginSummary = {
  userId: string;
  userName: string;
  userEmail: string;
  lastSeenAt: Date;
  sessionsToday: number;
};

/**
 * Eén rij per persoon (niet per sessie) — wie ooit een sessie had, wanneer
 * die persoon voor het laatst actief was, en hoeveel sessies vandaag
 * gestart zijn. Overzicht voor het hoofdscherm van Login-sessies, zodat
 * iemand met veel sessies niet meerdere keren in de lijst verschijnt.
 * Gebruikt groupBy (aggregatie in de database) i.p.v. elke rij zelf op te
 * halen, want dit scherm belast anders zwaar mee bij elke paginalading.
 */
export async function getLoginActivitySummary(options?: {
  userIds?: string[];
}): Promise<UserLoginSummary[]> {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot de login-sessies");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const userWhere = options?.userIds ? { userId: { in: options.userIds } } : {};

  const [lastSeenGroups, todayGroups] = await Promise.all([
    prisma.loginEvent.groupBy({
      by: ["userId"],
      where: userWhere,
      _max: { lastSeenAt: true },
    }),
    prisma.loginEvent.groupBy({
      by: ["userId"],
      where: { ...userWhere, createdAt: { gte: today, lt: tomorrow } },
      _count: { _all: true },
    }),
  ]);
  if (lastSeenGroups.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: lastSeenGroups.map((g) => g.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const todayCountByUser = new Map(todayGroups.map((g) => [g.userId, g._count._all]));

  return lastSeenGroups
    .map((g) => {
      const user = userById.get(g.userId);
      return {
        userId: g.userId,
        userName: user?.name ?? "Onbekend",
        userEmail: user?.email ?? "",
        lastSeenAt: g._max.lastSeenAt!,
        sessionsToday: todayCountByUser.get(g.userId) ?? 0,
      };
    })
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

export type DailyLoginActivity = { date: Date; sessionCount: number };
export type HourlyLoginActivity = { hour: number; sessionCount: number };
export type LoginActivityDetail = {
  byDay: DailyLoginActivity[];
  byHour: HourlyLoginActivity[];
  totalSessions: number;
};

/**
 * Uitgebreide activiteit van één gebruiker over de laatste `days` dagen
 * (standaard 30): aantal sessies per dag (nieuwste eerst, inclusief dagen
 * zonder activiteit) én per uur van de dag (0-23, over alle dagen samen —
 * toont dus patronen zoals "vooral 's ochtends actief"). Eén query voor
 * beide, want ze draaien op dezelfde ruwe sessies. Geen `take`-limiet zoals
 * getLoginEvents, want een erg actieve gebruiker kan over 30 dagen
 * makkelijk meer dan 200 sessies hebben.
 */
export async function getLoginActivityDetail(
  userId: string,
  days = 30
): Promise<LoginActivityDetail> {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot de login-sessies");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const events = await prisma.loginEvent.findMany({
    where: { userId, createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const countByDay = new Map<string, number>();
  const countByHour = new Array(24).fill(0) as number[];
  for (const event of events) {
    const key = dayKey(event.createdAt);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
    countByHour[event.createdAt.getHours()] += 1;
  }

  const byDay: DailyLoginActivity[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    byDay.push({ date, sessionCount: countByDay.get(dayKey(date)) ?? 0 });
  }

  const byHour: HourlyLoginActivity[] = countByHour.map((sessionCount, hour) => ({
    hour,
    sessionCount,
  }));

  return { byDay, byHour, totalSessions: events.length };
}
