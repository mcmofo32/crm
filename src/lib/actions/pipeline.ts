"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LeadType } from "@/generated/prisma/client";
import { canAccessOwner, getVisibleUserIds } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";

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
  leadType: LeadType
): Promise<PipelineStats> {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  const ownerWhere = ids ? { ownerId: { in: ids } } : {};

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, leadType, ...ownerWhere },
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
  phone: string | null;
  source: string | null;
  isInformed: boolean;
  qualityScore: number | null;
  lastContactedAt: Date | null;
  statusLabel: string;
  characteristics: string | null;
  callCount: number;
};

export async function getPipelineLeads(
  leadType: LeadType
): Promise<PipelineLeadRow[]> {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  const ownerWhere = ids ? { ownerId: { in: ids } } : {};

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, leadType, ...ownerWhere },
    select: {
      id: true,
      createdAt: true,
      firstName: true,
      lastName: true,
      phone: true,
      source: true,
      isInformed: true,
      qualityScore: true,
      lastContactedAt: true,
      characteristics: true,
      stage: { select: { label: true } },
      activities: { select: { type: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return leads.map((lead) => ({
    id: lead.id,
    createdAt: lead.createdAt,
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: lead.phone,
    source: lead.source,
    isInformed: lead.isInformed,
    qualityScore: lead.qualityScore,
    lastContactedAt: lead.lastContactedAt,
    statusLabel: lead.stage.label,
    characteristics: lead.characteristics,
    callCount: lead.activities.filter(
      (a) => a.type === "CALL" && a.status === "COMPLETED"
    ).length,
  }));
}

async function requireLeadAccessFor(leadId: string) {
  const user = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
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
