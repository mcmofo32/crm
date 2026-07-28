"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IncentiveGoalType, LeadType } from "@/generated/prisma/client";
import { canManageIncentives } from "@/lib/permissions";

const MAX_POSTER_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_POSTER_TYPES = ["image/jpeg", "image/jpg", "application/pdf"];

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  return session.user;
}

async function requireIncentiveManager() {
  const user = await requireUser();
  if (!canManageIncentives(user)) {
    throw new Error("Je hebt geen rechten om incentives te beheren");
  }
  return user;
}

export async function createIncentiveAction(formData: FormData) {
  const actor = await requireIncentiveManager();

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const goalType =
    (formData.get("goalType") as IncentiveGoalType) ??
    IncentiveGoalType.LEADS_WON;
  const leadTypeRaw = String(formData.get("leadType") ?? "");
  const leadType =
    leadTypeRaw === "FA" || leadTypeRaw === "RG"
      ? (leadTypeRaw as LeadType)
      : null;
  const targetValueRaw = String(formData.get("targetValue") ?? "");
  const targetValue = targetValueRaw ? Number(targetValueRaw) : null;
  const startDateRaw = String(formData.get("startDate") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "");

  if (!title || !description || !startDateRaw || !endDateRaw) {
    throw new Error(
      "Titel, vereisten en start-/einddatum zijn verplicht"
    );
  }

  const startDate = new Date(`${startDateRaw}T00:00:00`);
  const endDate = new Date(`${endDateRaw}T23:59:59.999`);
  if (endDate < startDate) {
    throw new Error("Einddatum moet na de startdatum liggen");
  }

  const poster = formData.get("poster");
  let posterData: Uint8Array<ArrayBuffer> | null = null;
  let posterMimeType: string | null = null;
  let posterFilename: string | null = null;

  if (poster instanceof File && poster.size > 0) {
    if (!ALLOWED_POSTER_TYPES.includes(poster.type)) {
      throw new Error("Poster moet een JPEG-afbeelding of PDF-bestand zijn");
    }
    if (poster.size > MAX_POSTER_BYTES) {
      throw new Error("Poster mag maximaal 8 MB groot zijn");
    }
    const arrayBuffer = await poster.arrayBuffer();
    posterData = new Uint8Array(arrayBuffer);
    posterMimeType = poster.type;
    posterFilename = poster.name;
  }

  const incentive = await prisma.incentive.create({
    data: {
      title,
      description,
      goalType,
      leadType,
      targetValue,
      startDate,
      endDate,
      posterData,
      posterMimeType,
      posterFilename,
      createdById: actor.id,
    },
  });

  revalidatePath("/incentives");
  redirect(`/incentives/${incentive.id}`);
}

export async function deleteIncentiveAction(incentiveId: string) {
  const actor = await requireIncentiveManager();
  const incentive = await prisma.incentive.findUnique({
    where: { id: incentiveId },
  });
  if (!incentive) throw new Error("Incentive niet gevonden");
  if (incentive.createdById !== actor.id && actor.role !== "BEHEERDER") {
    throw new Error("Je mag enkel je eigen incentives verwijderen");
  }

  await prisma.incentive.delete({ where: { id: incentiveId } });
  revalidatePath("/incentives");
  redirect("/incentives");
}

export type LeaderboardEntry = {
  userId: string;
  name: string;
  score: number;
};

export async function getIncentiveLeaderboard(
  incentiveId: string
): Promise<LeaderboardEntry[]> {
  const incentive = await prisma.incentive.findUnique({
    where: { id: incentiveId },
  });
  if (!incentive) return [];

  const activeUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });
  const scoreByUser = new Map<string, number>();
  for (const u of activeUsers) scoreByUser.set(u.id, 0);

  if (incentive.goalType === IncentiveGoalType.LEADS_WON) {
    const wins = await prisma.leadStageChange.findMany({
      where: {
        changedAt: { gte: incentive.startDate, lte: incentive.endDate },
        toStage: { isWon: true },
        ...(incentive.leadType ? { lead: { leadType: incentive.leadType } } : {}),
      },
      include: { lead: { select: { ownerId: true } } },
    });
    for (const win of wins) {
      const ownerId = win.lead.ownerId;
      scoreByUser.set(ownerId, (scoreByUser.get(ownerId) ?? 0) + 1);
    }
  } else {
    const completed = await prisma.activity.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: incentive.startDate, lte: incentive.endDate },
        ...(incentive.leadType
          ? { lead: { leadType: incentive.leadType } }
          : {}),
      },
      select: { assigneeId: true },
    });
    for (const activity of completed) {
      scoreByUser.set(
        activity.assigneeId,
        (scoreByUser.get(activity.assigneeId) ?? 0) + 1
      );
    }
  }

  return activeUsers
    .map((u) => ({ userId: u.id, name: u.name, score: scoreByUser.get(u.id) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
