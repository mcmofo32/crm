"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  IncentiveMetric,
  IncentiveMode,
  LeadType,
} from "@/generated/prisma/client";
import { canManageIncentives } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { METRIC_LABELS } from "@/lib/incentiveMetrics";

const MAX_POSTER_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_POSTER_TYPES = ["image/jpeg", "image/jpg", "application/pdf"];
const VALID_METRICS = new Set(Object.values(IncentiveMetric));

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

async function requireIncentiveManager() {
  const user = await requireUser();
  if (!canManageIncentives(user)) {
    throw new Error("Je hebt geen rechten om incentives te beheren");
  }
  return user;
}

function parseLeadType(raw: FormDataEntryValue | null | undefined): LeadType | null {
  const s = String(raw ?? "");
  return s === "FA" || s === "RG" ? (s as LeadType) : null;
}

function parseMetric(raw: FormDataEntryValue | null | undefined): IncentiveMetric | null {
  const s = String(raw ?? "");
  return VALID_METRICS.has(s as IncentiveMetric) ? (s as IncentiveMetric) : null;
}

export async function createIncentiveAction(formData: FormData) {
  const actor = await requireIncentiveManager();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const startDateRaw = String(formData.get("startDate") ?? "");
  const endDateRaw = String(formData.get("endDate") ?? "");
  const mode =
    formData.get("mode") === IncentiveMode.TOP_N
      ? IncentiveMode.TOP_N
      : IncentiveMode.THRESHOLD;

  if (!title || !description || !startDateRaw || !endDateRaw) {
    throw new Error("Titel, vereisten en start-/einddatum zijn verplicht");
  }

  const startDate = new Date(`${startDateRaw}T00:00:00`);
  const endDate = new Date(`${endDateRaw}T23:59:59.999`);
  if (endDate < startDate) {
    throw new Error("Einddatum moet na de startdatum liggen");
  }

  let rankingMetric: IncentiveMetric | null = null;
  let rankingLeadType: LeadType | null = null;
  let topN: number | null = null;
  let categoriesData: {
    metric: IncentiveMetric;
    leadType: LeadType | null;
    targetValue: number;
    order: number;
  }[] = [];

  if (mode === IncentiveMode.TOP_N) {
    rankingMetric =
      parseMetric(formData.get("rankingMetric")) ?? IncentiveMetric.CLIENTS_WON;
    rankingLeadType = parseLeadType(formData.get("rankingLeadType"));
    const topNRaw = Number(formData.get("topN") ?? 5);
    topN = Number.isFinite(topNRaw) && topNRaw >= 1 && topNRaw <= 10 ? Math.round(topNRaw) : 5;
  } else {
    const metrics = formData.getAll("categoryMetric");
    const leadTypes = formData.getAll("categoryLeadType");
    const targets = formData.getAll("categoryTarget");

    categoriesData = metrics
      .map((raw, index) => {
        const metric = parseMetric(raw);
        const targetValue = Number(targets[index] ?? 0);
        if (!metric || !Number.isFinite(targetValue) || targetValue < 1) {
          return null;
        }
        return {
          metric,
          leadType: parseLeadType(leadTypes[index]),
          targetValue: Math.round(targetValue),
          order: index,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);

    if (categoriesData.length === 0) {
      throw new Error("Voeg minstens één categorie met een richtcijfer toe");
    }
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
      mode,
      rankingMetric,
      rankingLeadType,
      topN,
      startDate,
      endDate,
      posterData,
      posterMimeType,
      posterFilename,
      createdById: actor.id,
      ...(categoriesData.length > 0
        ? { categories: { create: categoriesData } }
        : {}),
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

export type CategoryProgress = {
  metric: IncentiveMetric;
  label: string;
  raw: number;
  target: number;
  ratio: number;
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  score: number;
  progressPercent: number;
  achieved: boolean;
  metricLabel?: string;
  categories?: CategoryProgress[];
};

/** Telt de score per gebruiker op voor één meting, binnen de looptijd van een incentive. */
async function computeMetricScores(
  metric: IncentiveMetric,
  leadTypeFilter: LeadType | null,
  startDate: Date,
  endDate: Date
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  const add = (id: string, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);

  if (metric === IncentiveMetric.CLIENTS_WON || metric === IncentiveMetric.UNITS) {
    const wins = await prisma.leadStageChange.findMany({
      where: {
        changedAt: { gte: startDate, lte: endDate },
        toStage: { isWon: true },
        ...(leadTypeFilter ? { lead: { leadType: leadTypeFilter } } : {}),
      },
      include: {
        lead: {
          select: {
            ownerId: true,
            products: { select: { units: true } },
          },
        },
      },
    });
    for (const win of wins) {
      const totalUnits = win.lead.products.reduce((sum, p) => sum + p.units, 0);
      add(win.lead.ownerId, metric === IncentiveMetric.UNITS ? totalUnits : 1);
    }
  } else {
    // RG_MEETINGS telt altijd enkel RG-leads, ongeacht een gekozen funnel-filter.
    const effectiveLeadType =
      metric === IncentiveMetric.RG_MEETINGS ? LeadType.RG : leadTypeFilter;
    const completed = await prisma.activity.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: startDate, lte: endDate },
        ...(effectiveLeadType ? { lead: { leadType: effectiveLeadType } } : {}),
      },
      select: { assigneeId: true },
    });
    for (const activity of completed) add(activity.assigneeId, 1);
  }

  return scores;
}

export async function getIncentiveLeaderboard(
  incentiveId: string
): Promise<LeaderboardEntry[]> {
  const incentive = await prisma.incentive.findUnique({
    where: { id: incentiveId },
    include: { categories: { orderBy: { order: "asc" } } },
  });
  if (!incentive) return [];

  const activeUsers = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  if (incentive.mode === IncentiveMode.TOP_N) {
    const metric = incentive.rankingMetric ?? IncentiveMetric.CLIENTS_WON;
    const topN = incentive.topN ?? 5;
    const scores = await computeMetricScores(
      metric,
      incentive.rankingLeadType,
      incentive.startDate,
      incentive.endDate
    );
    const topScore = Math.max(0, ...activeUsers.map((u) => scores.get(u.id) ?? 0));

    return activeUsers
      .map((u) => ({ userId: u.id, name: u.name, score: scores.get(u.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .map((entry, index) => ({
        ...entry,
        progressPercent: topScore > 0 ? Math.round((entry.score / topScore) * 100) : 0,
        achieved: entry.score > 0 && index < topN,
        metricLabel: METRIC_LABELS[metric],
      }));
  }

  // THRESHOLD: elke categorie heeft een eigen richtcijfer.
  const categoryScores = await Promise.all(
    incentive.categories.map(async (category) => ({
      category,
      scores: await computeMetricScores(
        category.metric,
        category.leadType,
        incentive.startDate,
        incentive.endDate
      ),
    }))
  );

  const entries = activeUsers.map((u) => {
    const categories: CategoryProgress[] = categoryScores.map(({ category, scores }) => {
      const raw = scores.get(u.id) ?? 0;
      const ratio =
        category.targetValue > 0 ? Math.min(raw / category.targetValue, 1) : raw > 0 ? 1 : 0;
      return {
        metric: category.metric,
        label: METRIC_LABELS[category.metric],
        raw,
        target: category.targetValue,
        ratio,
      };
    });
    const progressPercent =
      categories.length > 0
        ? Math.round(
            (categories.reduce((sum, c) => sum + c.ratio, 0) / categories.length) * 100
          )
        : 0;
    const achieved = categories.length > 0 && categories.every((c) => c.ratio >= 1);

    return {
      userId: u.id,
      name: u.name,
      score: progressPercent,
      progressPercent,
      achieved,
      categories,
    };
  });

  return entries.sort((a, b) => b.progressPercent - a.progressPercent);
}
