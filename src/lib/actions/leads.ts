"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ActivityStatus,
  ActivityType,
  LeadStatus,
  LeadType,
  type ProductType,
} from "@/generated/prisma/client";
import {
  canAccessOwner,
  canAccessLead,
  canDeleteLeads,
  canManageCustomerData,
  canViewBeheerderTools,
  getVisibleUserIds,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getEffectiveViewer } from "@/lib/impersonation";
import {
  ensureDefaultPipelineStage,
  ensureFunnelStages,
  mainFunnelStageKeys,
} from "@/lib/funnelStages";
import { normalizePhone, findLeadsByContact } from "@/lib/actions/duplicates";
import { PRODUCT_TYPE_ORDER } from "@/lib/productTypes";
import { contactState } from "@/lib/contactState";
import { getSubagents } from "@/lib/actions/subagents";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/** Bestaat er al een (niet-verwijderde) lead van deze eigenaar met hetzelfde telefoonnummer? */
export async function findOwnLeadWithSamePhone(ownerId: string, phone: string | null) {
  const target = normalizePhone(phone);
  if (!target) return null;

  const ownLeads = await prisma.lead.findMany({
    where: { ownerId, deletedAt: null, phone: { not: null } },
    select: { firstName: true, lastName: true, phone: true },
  });
  return ownLeads.find((l) => normalizePhone(l.phone) === target) ?? null;
}

export async function createLeadAction(formData: FormData) {
  const user = await requireUser();

  const leadType = formData.get("leadType") as LeadType;
  const requestedOwnerId = String(formData.get("ownerId") ?? user.id);
  const ownerId = (await canAccessOwner(user, requestedOwnerId))
    ? requestedOwnerId
    : user.id;

  const phone = (formData.get("phone") as string) || null;
  const existingOwnLead = await findOwnLeadWithSamePhone(ownerId, phone);
  if (existingOwnLead) {
    throw new Error(
      `Bestaat al: ${existingOwnLead.firstName} ${existingOwnLead.lastName} heeft dit telefoonnummer al bij jouw leads.`
    );
  }

  const email = (formData.get("email") as string) || null;
  const contactMatches = await findLeadsByContact(email, phone);

  const defaultStageId = await ensureDefaultPipelineStage(leadType);

  const lead = await prisma.lead.create({
    data: {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email,
      phone,
      source: (formData.get("source") as string) || null,
      notes: (formData.get("notes") as string) || null,
      leadType,
      ownerId,
      createdById: user.id,
      stageId: defaultStageId,
    },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.created",
    entityType: "Lead",
    entityId: lead.id,
    description: `Lead "${lead.firstName} ${lead.lastName}" aangemaakt (${leadType})`,
  });

  revalidatePath("/leads");
  revalidatePath(`/funnel/${leadType}`);

  const duplicate = contactMatches[0];
  const duplicateQuery = duplicate
    ? `?duplicateName=${encodeURIComponent(
        `${duplicate.firstName} ${duplicate.lastName}`
      )}&duplicateOwner=${encodeURIComponent(duplicate.ownerName)}`
    : "";
  redirect(`/leads/${lead.id}${duplicateQuery}`);
}

/**
 * Kernlogica om een lead rechtstreeks als klant (status WON, op de
 * "Klant"/"Medewerker"-fase) aan te maken mét producten: gebruikt zowel
 * door `createCustomerAction` (één klant via het formulier) als door de
 * bulk-import vanuit Excel (`importCustomersBulkAction`, elders). Zet meteen
 * ook de LeadStageChange (voor de productiestatistieken) en de
 * Policy-lijnen per product. `occurredAt` bepaalt zowel `createdAt` als het
 * moment van de stage-overgang — bij een bulk-import is dat de historische
 * datum uit het bronbestand i.p.v. het importmoment, zodat cijfers per
 * maand/jaar kloppen.
 */
export async function createWonLeadRecord(params: {
  actorId: string;
  ownerId: string;
  leadType: LeadType;
  wonStageId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  products: { type: ProductType; amount: number; units: number }[];
  occurredAt: Date;
  /** Expliciet gekozen dossierbeheerder (subagent) — anders standaard de aanbrenger (ownerId). */
  caseManagerSubagentId?: string | null;
}) {
  const lead = await prisma.lead.create({
    data: {
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phone: params.phone,
      source: params.source,
      leadType: params.leadType,
      ownerId: params.ownerId,
      createdById: params.actorId,
      // Dossierbeheerder: de expliciet gekozen subagent, anders standaard de
      // aanbrenger (ownerId) — niet wie de actie uitvoerde, zelfde reden als
      // bij changedById hierboven: een Beheerder/Admin die een bulk-import
      // doet namens medewerkers mag daardoor niet zelf dossierbeheerder van
      // al die klanten worden.
      ...(params.caseManagerSubagentId
        ? { caseManagerSubagentId: params.caseManagerSubagentId }
        : { caseManagerUserId: params.ownerId }),
      stageId: params.wonStageId,
      status: LeadStatus.WON,
      createdAt: params.occurredAt,
    },
  });

  await prisma.$transaction([
    prisma.leadStageChange.create({
      data: {
        leadId: lead.id,
        fromStageId: null,
        toStageId: params.wonStageId,
        // De eigenaar/verkoper krijgt het "behaalde klant"-krediet voor de
        // productiemaand-doelen, niet wie de actie toevallig uitvoerde (bv.
        // een Beheerder/Admin die een bulk-import doet namens medewerkers) —
        // anders schrijft de importeur alle klanten op zijn eigen teller bij.
        changedById: params.ownerId,
        changedAt: params.occurredAt,
      },
    }),
    ...params.products.map((p) =>
      prisma.leadProduct.create({
        data: {
          leadId: lead.id,
          type: p.type,
          amount: p.amount,
          units: p.units,
          contractDate: params.occurredAt,
          policy: { create: { leadId: lead.id, employeeId: params.ownerId } },
        },
      })
    ),
  ]);

  return lead;
}

/**
 * Maakt een lead rechtstreeks aan als klant (fase "Klant"/"Medewerker",
 * status WON) mét producten, in één stap — vooral bedoeld om bestaande
 * klanten uit een oud systeem over te zetten, zonder ze eerst door de hele
 * funnel te moeten laten lopen. Zelfde rechten als een deal effectief
 * afsluiten: enkel subagenten (of Beheerder/Admin).
 */
export async function createCustomerAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen een klant rechtstreeks aanmaken");
  }

  const leadType = formData.get("leadType") as LeadType;
  const requestedOwnerId = String(formData.get("ownerId") ?? user.id);
  const ownerId = (await canAccessOwner(user, requestedOwnerId))
    ? requestedOwnerId
    : user.id;

  // Dossierbeheerder kan enkel een subagent zijn (nooit "gewoon" de
  // aanbrenger) — dus enkel verplicht kiesbaar uit de subagenten die deze
  // actor mag toewijzen (zelfde lijst als op het formulier). Is er geen
  // enkele subagent beschikbaar om uit te kiezen, dan blijft de oude
  // fallback (dossierbeheerder = aanbrenger) de enige mogelijke optie.
  const availableSubagents = await getSubagents();
  const requestedCaseManagerSubagentId =
    String(formData.get("caseManagerSubagentId") ?? "").trim() || null;
  const caseManagerSubagentId = requestedCaseManagerSubagentId
    ? availableSubagents.find((s) => s.id === requestedCaseManagerSubagentId)?.id ?? null
    : null;
  if (availableSubagents.length > 0 && !caseManagerSubagentId) {
    throw new Error("Kies een dossierbeheerder (kan enkel een subagent zijn)");
  }

  const phone = (formData.get("phone") as string) || null;
  const existingOwnLead = await findOwnLeadWithSamePhone(ownerId, phone);
  if (existingOwnLead) {
    throw new Error(
      `Bestaat al: ${existingOwnLead.firstName} ${existingOwnLead.lastName} heeft dit telefoonnummer al bij jouw leads.`
    );
  }

  const email = (formData.get("email") as string) || null;

  const products: { type: ProductType; amount: number; units: number }[] = [];
  for (const type of PRODUCT_TYPE_ORDER) {
    const amountRaw = String(formData.get(`amount-${type}`) ?? "").trim();
    const unitsRaw = String(formData.get(`units-${type}`) ?? "").trim();
    const amount = amountRaw ? Number(amountRaw) : 0;
    const units = unitsRaw ? Math.round(Number(unitsRaw)) : 0;
    if (Number.isFinite(amount) && amount > 0) {
      products.push({ type, amount, units: Number.isFinite(units) ? units : 0 });
    }
  }
  if (products.length === 0) {
    throw new Error("Voeg minstens één product met een bedrag toe");
  }

  await ensureFunnelStages(leadType);
  const wonStage = await prisma.funnelStage.findFirst({
    where: { leadType, isWon: true },
  });
  if (!wonStage) throw new Error("Kon de klant-fase niet vinden");

  // "Klant sinds" bepaalt in welke productiemaand deze klant meetelt. Enkel
  // relevant om te verifiëren dat het niet in de toekomst ligt (achteraf een
  // bestaande klant uit een oud systeem invoeren gebeurt per definitie met
  // een datum uit het verleden) — valt terug op nu bij een lege/ongeldige
  // invoer.
  const becameCustomerAtRaw = String(formData.get("becameCustomerAt") ?? "").trim();
  const parsedBecameCustomerAt = becameCustomerAtRaw
    ? new Date(`${becameCustomerAtRaw}T12:00:00`)
    : null;
  const occurredAt =
    parsedBecameCustomerAt &&
    !Number.isNaN(parsedBecameCustomerAt.getTime()) &&
    parsedBecameCustomerAt.getTime() <= Date.now()
      ? parsedBecameCustomerAt
      : new Date();

  const lead = await createWonLeadRecord({
    actorId: user.id,
    ownerId,
    leadType,
    wonStageId: wonStage.id,
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email,
    phone,
    source: (formData.get("source") as string) || null,
    products,
    occurredAt,
    caseManagerSubagentId,
  });

  await logAudit({
    actorId: user.id,
    action: "lead.created",
    entityType: "Lead",
    entityId: lead.id,
    description: `Klant "${lead.firstName} ${lead.lastName}" rechtstreeks aangemaakt (${leadType}, bv. overgezet vanuit een oud systeem)`,
  });

  revalidatePath("/leads");
  revalidatePath("/klanten");
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent");
  revalidatePath("/subagent/polissen");
  revalidatePath(`/funnel/${leadType}`);

  redirect(`/leads/${lead.id}`);
}

/**
 * Maakt meerdere leads tegelijk aan vanuit een Excel-achtige invoertabel:
 * elke ingevulde rij (met minstens voornaam + achternaam) wordt één lead,
 * allemaal met dezelfde funnel en eigenaar.
 */
/**
 * Bulk-aanmaak van leads — altijd voor jezelf: wie de import doet, wordt
 * eigenaar van elke aangemaakte lead. `type` per rij is optioneel: leeg =
 * de standaard Funnel bovenaan het formulier, ingevuld (FA/RG) overschrijft
 * enkel die rij — zo kan één geplakte tabel meteen leads voor beide funnels
 * tegelijk aanmaken (bv. bij het importeren van je eigen oude leads).
 */
export async function createLeadsBulkAction(formData: FormData) {
  const user = await requireUser();

  const defaultLeadType = formData.get("leadType") as LeadType;

  const firstNames = formData.getAll("firstName");
  const lastNames = formData.getAll("lastName");
  const emails = formData.getAll("email");
  const phones = formData.getAll("phone");
  const sources = formData.getAll("source");
  const types = formData.getAll("type");

  const rawRows = firstNames.map((_, i) => ({
    firstName: String(firstNames[i] ?? "").trim(),
    lastName: String(lastNames[i] ?? "").trim(),
    email: String(emails[i] ?? "").trim() || null,
    phone: String(phones[i] ?? "").trim() || null,
    source: String(sources[i] ?? "").trim() || null,
    typeRaw: String(types[i] ?? "").trim(),
  }));

  const filledRows = rawRows.filter((row) => row.firstName || row.lastName);

  if (filledRows.length === 0) {
    throw new Error("Vul minstens één rij in met een voornaam");
  }
  // Achternaam is niet verplicht: kan later nog aangevuld worden op de lead zelf.
  if (filledRows.some((row) => !row.firstName)) {
    throw new Error("Elke ingevulde rij moet minstens een voornaam hebben");
  }

  const errors: string[] = [];
  const resolvedRows = filledRows.map((row, index) => {
    const rowNumber = index + 1;

    let leadType = defaultLeadType;
    if (row.typeRaw) {
      const normalized = row.typeRaw.toUpperCase();
      if (normalized !== "FA" && normalized !== "RG") {
        errors.push(
          `Rij ${rowNumber}: ongeldig type "${row.typeRaw}" (moet FA of RG zijn)`
        );
      } else {
        leadType = normalized as LeadType;
      }
    }

    return {
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      source: row.source,
      leadType,
    };
  });

  if (errors.length > 0) {
    throw new Error(errors.join(" — "));
  }

  const usedLeadTypes = Array.from(new Set(resolvedRows.map((r) => r.leadType)));
  const stageIdByType = new Map(
    await Promise.all(
      usedLeadTypes.map(
        async (type) => [type, await ensureDefaultPipelineStage(type)] as const
      )
    )
  );

  const created = await prisma.$transaction(
    resolvedRows.map((row) =>
      prisma.lead.create({
        data: {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email,
          phone: row.phone,
          source: row.source,
          leadType: row.leadType,
          ownerId: user.id,
          createdById: user.id,
          stageId: stageIdByType.get(row.leadType)!,
        },
      })
    )
  );

  await logAudit({
    actorId: user.id,
    action: "lead.bulk_created",
    entityType: "Lead",
    entityId: created[0].id,
    description: `${created.length} leads in bulk aangemaakt`,
  });

  revalidatePath("/leads");
  for (const type of usedLeadTypes) revalidatePath(`/funnel/${type}`);
  redirect("/leads");
}

export async function updateLeadStageAction(
  leadId: string,
  toStageId: string,
  notes?: string
) {
  const [user, lead, toStage] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({
      where: { id: leadId },
      include: { stage: true },
    }),
    prisma.funnelStage.findUnique({ where: { id: toStageId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessLead(user, lead))) {
    throw new Error("Geen toegang tot deze lead");
  }

  if (!toStage || toStage.leadType !== lead.leadType) {
    throw new Error("Ongeldige funnel-stage");
  }
  if (toStage.isWon && !canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen een lead als klant afsluiten");
  }

  const status = toStage.isWon
    ? LeadStatus.WON
    : toStage.isLost
    ? LeadStatus.LOST
    : LeadStatus.OPEN;

  const trimmedNotes = notes?.trim();
  const now = new Date();

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        stageId: toStageId,
        status,
        ...(trimmedNotes ? { lastContactedAt: now } : {}),
        // Dossierbeheerder standaard op wie de klant maakte, tenzij al
        // eerder (bv. manueel) ingesteld.
        ...(status === LeadStatus.WON &&
        !lead.caseManagerUserId &&
        !lead.caseManagerSubagentId
          ? { caseManagerUserId: user.id }
          : {}),
      },
    }),
    prisma.leadStageChange.create({
      data: {
        leadId,
        fromStageId: lead.stageId,
        toStageId,
        changedById: user.id,
      },
    }),
    ...(trimmedNotes
      ? [
          prisma.activity.create({
            data: {
              leadId,
              assigneeId: user.id,
              type: ActivityType.NOTE,
              status: ActivityStatus.COMPLETED,
              subject: `Verplaatst naar ${toStage.label}`,
              notes: trimmedNotes,
              scheduledAt: now,
              completedAt: now,
            },
          }),
        ]
      : []),
  ]);

  await logAudit({
    actorId: user.id,
    action: "lead.stageChanged",
    entityType: "Lead",
    entityId: leadId,
    description: `Lead "${lead.firstName} ${lead.lastName}" verplaatst van "${lead.stage.label}" naar "${toStage.label}"`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/** Wijzigt de contactgegevens van een bestaande lead (naam, e-mail, telefoon, bedrijf, bron, notities). */
export async function updateLeadDetailsAction(leadId: string, formData: FormData) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!firstName) {
    throw new Error("Voornaam is verplicht");
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstName,
      lastName,
      email: (formData.get("email") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      company: (formData.get("company") as string)?.trim() || null,
      source: (formData.get("source") as string)?.trim() || null,
      notes: (formData.get("notes") as string) || null,
    },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.updated",
    entityType: "Lead",
    entityId: leadId,
    description: `Gegevens van lead "${firstName} ${lastName}" gewijzigd`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/funnel/${lead.leadType}`);
}

/**
 * Zet enkel het e-mailadres van een lead (bv. de melding om een e-mailadres
 * toe te voegen bij het verplaatsen naar "Financiële analyse ingepland"),
 * zonder de andere contactgegevens aan te raken.
 */
export async function updateLeadEmailAction(leadId: string, email: string) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) return;

  await prisma.lead.update({
    where: { id: leadId },
    data: { email: trimmedEmail },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.updated",
    entityType: "Lead",
    entityId: leadId,
    description: `E-mailadres van lead "${lead.firstName} ${lead.lastName}" ingevuld: ${trimmedEmail}`,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath(`/funnel/${lead.leadType}`);
}

/** Verwijdert een lead (soft delete): ze komt in de prullenbak i.p.v. definitief weg te zijn. */
export async function deleteLeadAction(leadId: string) {
  const user = await requireUser();
  if (!canDeleteLeads(user)) {
    throw new Error("Je mag geen leads verwijderen");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");

  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.deleted",
    entityType: "Lead",
    entityId: lead.id,
    description: `Lead "${lead.firstName} ${lead.lastName}" verwijderd (naar prullenbak)`,
  });

  revalidatePath("/leads");
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
  revalidatePath("/beheer/prullenbak");
}

/** Haalt een lead terug uit de prullenbak. */
export async function restoreLeadAction(leadId: string) {
  const user = await requireUser();
  if (!canViewBeheerderTools(user)) {
    throw new Error("Je mag geen leads herstellen");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.deletedAt) throw new Error("Lead niet gevonden in prullenbak");

  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: null, deletedById: null },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.restored",
    entityType: "Lead",
    entityId: lead.id,
    description: `Lead "${lead.firstName} ${lead.lastName}" hersteld uit de prullenbak`,
  });

  revalidatePath("/leads");
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/beheer/prullenbak");
}

/** Lijst van verwijderde leads voor de prullenbak-pagina. */
export async function getDeletedLeads() {
  const user = await requireUser();
  if (!canViewBeheerderTools(user)) {
    throw new Error("Je hebt geen toegang tot de prullenbak");
  }

  return prisma.lead.findMany({
    where: { deletedAt: { not: null } },
    include: { owner: true, deletedBy: true },
    orderBy: { deletedAt: "desc" },
  });
}

/**
 * "te_contacteren"/"voicemail" gebruiken dezelfde contactState-definitie als
 * de Pipeline-pagina (nog geen enkel gesprek gehad, resp. enkel voicemail
 * gehad) — zie contactState() hieronder, ipv de simpelere lastContactedAt-
 * check die "none" gebruikt.
 */
export type LeadContactFilter = "none" | "overdue" | "te_contacteren" | "voicemail";
export type LeadSortOption = "recent" | "stale";
/**
 * Categoriseert leads op het leadsoverzicht/Pipeline, zodat een lange lijst
 * overzichtelijk blijft: "open" = nog niet gewonnen/verloren, "ingepland" =
 * staat in één van de 3 actieve funnel-fases (bv. Financiële
 * analyse/Adviesgesprek/Opvolggesprek voor FA — zie mainFunnelStageKeys),
 * "geen_interesse" = status LOST, "klanten" = status WON.
 */
export type LeadCategoryFilter = "open" | "ingepland" | "geen_interesse" | "klanten";

export async function getLeadsForCurrentUser(
  leadType?: LeadType,
  search?: string,
  options?: {
    stageId?: string;
    ownerId?: string;
    /** Toont leads van al deze eigenaars samen (bv. "heel mijn team" voor een Coach). */
    ownerIds?: string[];
    contactFilter?: LeadContactFilter;
    category?: LeadCategoryFilter;
    sortBy?: LeadSortOption;
  }
) {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  const trimmedSearch = search?.trim();
  const now = new Date();

  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(ids ? { ownerId: { in: ids } } : {}),
      ...(leadType ? { leadType } : {}),
      ...(options?.stageId ? { stageId: options.stageId } : {}),
      ...(options?.ownerIds
        ? { ownerId: { in: options.ownerIds } }
        : options?.ownerId
        ? { ownerId: options.ownerId }
        : {}),
      ...(options?.contactFilter === "none"
        ? { lastContactedAt: null }
        : {}),
      ...(options?.contactFilter === "overdue"
        ? { activities: { some: { status: "PLANNED", scheduledAt: { lt: now } } } }
        : {}),
      ...(options?.category === "open" ? { status: "OPEN" } : {}),
      ...(options?.category === "geen_interesse" ? { status: "LOST" } : {}),
      ...(options?.category === "klanten" ? { status: "WON" } : {}),
      ...(options?.category === "ingepland"
        ? {
            stage: {
              key: {
                in: leadType
                  ? mainFunnelStageKeys(leadType)
                  : [...mainFunnelStageKeys("FA"), ...mainFunnelStageKeys("RG")],
              },
            },
          }
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
    include: {
      stage: true,
      owner: true,
      // Volledige activiteiten-historiek (niet enkel de eerstvolgende
      // geplande) opgehaald, want contactState() hieronder heeft alle
      // gesprekken nodig om "te_contacteren"/"voicemail" te bepalen — de
      // weergave van de eerstvolgende geplande activiteit wordt verderop uit
      // diezelfde lijst afgeleid.
      activities: {
        select: { type: true, status: true, scheduledAt: true, wasVoicemail: true },
      },
    },
    orderBy:
      options?.sortBy === "stale"
        ? { lastContactedAt: { sort: "asc", nulls: "first" } }
        : { createdAt: "desc" },
  });

  // "Te contacteren"/"voicemail" zijn geen kolom op Lead maar afgeleid uit de
  // volledige activiteiten-historiek, dus niet mogelijk in de Prisma `where`
  // hierboven — hier pas na het ophalen filteren.
  const contactStateFiltered =
    options?.contactFilter === "te_contacteren"
      ? leads.filter((lead) => contactState(lead.activities) === "TE_CONTACTEREN")
      : options?.contactFilter === "voicemail"
      ? leads.filter((lead) => contactState(lead.activities) === "VOICEMAIL")
      : leads;

  return contactStateFiltered.map((lead) => ({
    ...lead,
    activities: lead.activities
      .filter((a) => a.status === "PLANNED" && a.scheduledAt && a.scheduledAt >= now)
      .sort((a, b) => a.scheduledAt!.getTime() - b.scheduledAt!.getTime())
      .slice(0, 1),
  }));
}

/** Alle funnel-stages (beide leadtypes), gebruikt om op fase te filteren op de leadslijst. */
export async function getFunnelStagesForFilter() {
  const [, stages] = await Promise.all([
    requireUser(),
    prisma.funnelStage.findMany({
      orderBy: [{ leadType: "asc" }, { order: "asc" }],
    }),
  ]);
  return stages;
}

/**
 * Standaard enkel actieve gebruikers — je kan geen nieuwe lead/klant
 * toewijzen aan iemand die niet meer kan inloggen, en ook filter-
 * keuzelijsten ("Bekijk klanten/taken van") horen enkel actieve collega's
 * te tonen. `includeInactive` is enkel bedoeld voor historische
 * rapportage (bv. Analyse/Auditlog), waar je net wel nog wil kunnen
 * filteren op iemand die intussen inactief is.
 */
export async function getAssignableUsers(options?: { includeInactive?: boolean }) {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  return prisma.user.findMany({
    where: {
      deletedAt: null,
      ...(options?.includeInactive ? {} : { active: true }),
      ...(ids ? { id: { in: ids } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
