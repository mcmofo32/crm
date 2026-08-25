"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LeadType } from "@/generated/prisma/client";
import { canAccessOwner } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { mainFunnelStageKeys, NEW_LEAD_STAGE_KEY } from "@/lib/funnelStages";
import { contactState } from "@/lib/contactState";
import type { LeadCategoryFilter } from "@/lib/actions/leads";

/**
 * Zoals LeadCategoryFilter, maar met "opvolging" erbij (nog niet succesvol
 * bereikt, gelijk aan de 3 statistiekkaarten samen) en de twee individuele
 * deelverzamelingen ervan, "te_contacteren" en "voicemail" — enkel relevant
 * op de Pipeline-pagina, dus niet in het gedeelde type op /leads.
 */
export type PipelineCategoryFilter =
  | LeadCategoryFilter
  | "opvolging"
  | "te_contacteren"
  | "voicemail";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
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
  messageSent: boolean;
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
      // "Opvolging"/"Te contacteren"/"Voicemail" hebben, net als de
      // statistieken erboven, enkel zin voor nog actieve leads — een lead
      // die al klant is of al geen interesse heeft hoeft niet meer
      // opgevolgd te worden.
      ...(category === "open" ||
      category === "opvolging" ||
      category === "te_contacteren" ||
      category === "voicemail"
        ? { status: "OPEN" }
        : {}),
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
      messageSent: true,
      qualityScore: true,
      lastContactedAt: true,
      characteristics: true,
      stageId: true,
      stage: { select: { key: true, label: true } },
      activities: {
        select: { type: true, status: true, scheduledAt: true, wasVoicemail: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // "Opvolging" betekent specifiek dat er een uitgaand gesprek in de
  // toekomst ingepland staat (TERUGKOPPELEN) — niet zomaar "nog niet
  // succesvol bereikt", want dat overlapt dan met "Te contacteren"/
  // "Voicemail", die elk hun eigen, exclusieve deel al apart tonen.
  const filtered =
    category === "opvolging"
      ? leads.filter((lead) => contactState(lead.activities) === "TERUGKOPPELEN")
      : category === "te_contacteren"
      ? leads.filter((lead) => contactState(lead.activities) === "TE_CONTACTEREN")
      : category === "voicemail"
      ? leads.filter((lead) => contactState(lead.activities) === "VOICEMAIL")
      : leads;

  return filtered.map((lead) => {
    // Een lead die nog op "Nieuwe lead" staat maar al een toekomstig
    // terugbelmoment heeft (TERUGKOPPELEN) toont hier "Opvolging" i.p.v.
    // de rauwe fase-naam — de fase zelf (stageId) verandert niet, dit is
    // enkel de weergave in de Status-kolom. Enkel TERUGKOPPELEN, niet
    // TE_CONTACTEREN/VOICEMAIL: "Opvolging" betekent hier specifiek dat er
    // een opvolggesprek ingepland staat, niet gewoon "nog niet bereikt".
    const hasPlannedFollowUp =
      lead.stage.key === NEW_LEAD_STAGE_KEY &&
      contactState(lead.activities) === "TERUGKOPPELEN";

    return {
      id: lead.id,
      createdAt: lead.createdAt,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      isInformed: lead.isInformed,
      messageSent: lead.messageSent,
      qualityScore: lead.qualityScore,
      lastContactedAt: lead.lastContactedAt,
      stageId: lead.stageId,
      statusLabel: hasPlannedFollowUp ? "Opvolging" : lead.stage.label,
      characteristics: lead.characteristics,
      // Telt elk telefoongesprek (bereikt of voicemail) én elke ingeplande
      // afspraak — die laatste vereist immers ook een telefoongesprek om in
      // te plannen, maar telt maar één keer mee (dus niet nog eens apart
      // loggen als telefoongesprek voor diezelfde inplanning).
      callCount: lead.activities.filter(
        (a) => (a.type === "CALL" && a.status === "COMPLETED") || a.type === "MEETING"
      ).length,
    };
  });
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

/**
 * Laat de Datum-kolom (createdAt) van een lead aanpassen — nodig om oude
 * leads (van vóór dit CRM, of laattijdig ingevoerd) onder hun eigenlijke
 * datum te kunnen zetten i.p.v. de dag waarop ze hier ingevoerd werden. Dit
 * bepaalt mee in welke productiemaand ze meetellen voor de
 * Aanbevelingen-KPI (zie production.ts).
 */
export async function setLeadCreatedAtAction(leadId: string, formData: FormData) {
  await requireLeadAccessFor(leadId);
  const raw = String(formData.get("createdAt") ?? "").trim();
  if (!raw) throw new Error("Kies een datum");
  const value = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(value.getTime())) throw new Error("Ongeldige datum");

  await prisma.lead.update({
    where: { id: leadId },
    data: { createdAt: value },
  });

  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
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

export async function setLeadMessageSentAction(leadId: string, formData: FormData) {
  await requireLeadAccessFor(leadId);
  const messageSent = formData.get("messageSent") === "true";

  await prisma.lead.update({
    where: { id: leadId },
    data: { messageSent },
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
