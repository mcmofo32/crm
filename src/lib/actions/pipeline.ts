"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LeadType } from "@/generated/prisma/client";
import { canAccessOwner } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { mainFunnelStageKeys } from "@/lib/funnelStages";
import type { LeadCategoryFilter } from "@/lib/actions/leads";

/** Zoals LeadCategoryFilter, maar met "opvolging" erbij — enkel relevant op de Pipeline-pagina, dus niet in het gedeelde type op /leads. */
export type PipelineCategoryFilter = LeadCategoryFilter | "opvolging";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

type ContactState = "TE_CONTACTEREN" | "VOICEMAIL" | "TERUGKOPPELEN" | "OVERIG";

function contactState(
  activities: { type: string; status: string; scheduledAt: Date | null; wasVoicemail: boolean }[]
): ContactState {
  const now = new Date();
  const hasPlannedCallback = activities.some(
    (a) => a.type === "CALL" && a.status === "PLANNED" && a.scheduledAt && a.scheduledAt > now
  );
  if (hasPlannedCallback) return "TERUGKOPPELEN";

  const completedCalls = activities.filter(
    (a) => a.type === "CALL" && a.status === "COMPLETED"
  );
  const wasReached = completedCalls.some((a) => !a.wasVoicemail);
  if (wasReached) return "OVERIG";

  return completedCalls.some((a) => a.wasVoicemail) ? "VOICEMAIL" : "TE_CONTACTEREN";
}

export type PipelineStats = {
  openReferrals: number;
  teContacteren: number;
  voicemail: number;
  terugkoppelen: number;
};

export async function getPipelineStats(
  leadType: LeadType,
  ownerId: string
): Promise<PipelineStats> {
  const user = await requireUser();
  if (!(await canAccessOwner(user, ownerId))) {
    throw new Error("Geen toegang tot deze medewerker");
  }

  const leads = await prisma.lead.findMany({
    // status: "OPEN" — enkel nog actieve leads tellen mee. Een lead die al
    // klant is (WON) of al als geen interesse gemarkeerd is (LOST) hoort
    // niet meer thuis bij "te contacteren"/"voicemail"/"terugkoppelen",
    // ongeacht hoe zijn call-geschiedenis eruitziet.
    where: { deletedAt: null, leadType, ownerId, status: "OPEN" },
    select: {
      source: true,
      activities: {
        select: { type: true, status: true, scheduledAt: true, wasVoicemail: true },
      },
    },
  });

  let openReferrals = 0;
  let teContacteren = 0;
  let voicemail = 0;
  let terugkoppelen = 0;

  for (const lead of leads) {
    const state = contactState(lead.activities);
    if (state === "TE_CONTACTEREN" || state === "VOICEMAIL") {
      teContacteren++;
      if (lead.source?.trim()) openReferrals++;
    }
    if (state === "VOICEMAIL") voicemail++;
    if (state === "TERUGKOPPELEN") terugkoppelen++;
  }

  return { openReferrals, teContacteren, voicemail, terugkoppelen };
}

export type PipelineLeadRow = {
  id: string;
  createdAt: Date;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  isInformed: boolean;
  qualityScore: number | null;
  lastContactedAt: Date | null;
  stageId: string;
  statusLabel: string;
  characteristics: string | null;
  callCount: number;
};

export async function getPipelineLeads(
  leadType: LeadType,
  ownerId: string,
  search?: string,
  category?: PipelineCategoryFilter
): Promise<PipelineLeadRow[]> {
  const user = await requireUser();
  if (!(await canAccessOwner(user, ownerId))) {
    throw new Error("Geen toegang tot deze medewerker");
  }
  const trimmedSearch = search?.trim();

  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      leadType,
      ownerId,
      // "Opvolging" heeft, net als de statistieken erboven, enkel zin voor
      // nog actieve leads — een lead die al klant is of al geen interesse
      // heeft hoeft niet meer opgevolgd te worden.
      ...(category === "open" || category === "opvolging" ? { status: "OPEN" } : {}),
      ...(category === "geen_interesse" ? { status: "LOST" } : {}),
      ...(category === "klanten" ? { status: "WON" } : {}),
      ...(category === "ingepland"
        ? { stage: { key: { in: mainFunnelStageKeys(leadType) } } }
        : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { firstName: { contains: trimmedSearch, mode: "insensitive" } },
              { lastName: { contains: trimmedSearch, mode: "insensitive" } },
              { email: { contains: trimmedSearch, mode: "insensitive" } },
              { phone: { contains: trimmedSearch, mode: "insensitive" } },
              { company: { contains: trimmedSearch, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      createdAt: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      source: true,
      isInformed: true,
      qualityScore: true,
      lastContactedAt: true,
      characteristics: true,
      stageId: true,
      stage: { select: { label: true } },
      activities: {
        select: { type: true, status: true, scheduledAt: true, wasVoicemail: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // "Opvolging" = iedereen die nog niet succesvol bereikt is (nog te
  // contacteren, enkel voicemail gehad, of een toekomstig terugbelmoment
  // heeft) — zelfde definitie als de 3 statistiekkaarten erboven.
  const filtered =
    category === "opvolging"
      ? leads.filter((lead) => contactState(lead.activities) !== "OVERIG")
      : leads;

  return filtered.map((lead) => ({
    id: lead.id,
    createdAt: lead.createdAt,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    isInformed: lead.isInformed,
    qualityScore: lead.qualityScore,
    lastContactedAt: lead.lastContactedAt,
    stageId: lead.stageId,
    statusLabel: lead.stage.label,
    characteristics: lead.characteristics,
    // Telt elk telefoongesprek (bereikt of voicemail) én elke ingeplande
    // afspraak — die laatste vereist immers ook een telefoongesprek om in
    // te plannen, maar telt maar één keer mee (dus niet nog eens apart
    // loggen als telefoongesprek voor diezelfde inplanning).
    callCount: lead.activities.filter(
      (a) => (a.type === "CALL" && a.status === "COMPLETED") || a.type === "MEETING"
    ).length,
  }));
}

async function requireLeadAccessFor(leadId: string) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  return lead;
}

export async function setLeadQualityScoreAction(
  leadId: string,
  formData: FormData
) {
  await requireLeadAccessFor(leadId);
  const raw = String(formData.get("qualityScore") ?? "").trim();
  const value = raw ? Math.max(0, Math.min(10, Math.round(Number(raw)))) : null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { qualityScore: Number.isFinite(value as number) ? value : null },
  });

  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
}

export async function setLeadInformedAction(leadId: string, formData: FormData) {
  await requireLeadAccessFor(leadId);
  const isInformed = formData.get("isInformed") === "true";

  await prisma.lead.update({
    where: { id: leadId },
    data: { isInformed },
  });

  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
}

export async function setLeadCharacteristicsAction(
  leadId: string,
  formData: FormData
) {
  await requireLeadAccessFor(leadId);
  const characteristics = String(formData.get("characteristics") ?? "").trim() || null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { characteristics },
  });

  revalidatePath("/pipeline/recrutering");
}
