"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ProductType,
  LeadType,
  TaxDeclarationStatus,
  Role,
} from "@/generated/prisma/client";
import {
  canAccessOwner,
  canAccessLead,
  canManageCustomerData,
  canManageUsers,
} from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { PRODUCT_TYPE_ORDER } from "@/lib/productTypes";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/**
 * Klanten-eigenaarscope: enkel Beheerder/Admin mogen klanten van andere
 * mensen bekijken (via "Bekijk klanten van"). Een Coach ziet hier — anders
 * dan bij leads/pipeline/funnel — enkel zijn eigen klanten, niet die van
 * zijn medewerkers.
 */
function customerOwnerScope(user: { id: string; role: Role }): string[] | null {
  return canManageUsers(user) ? null : [user.id];
}

/**
 * Bouwt de eigenaar-filter voor klantenqueries: binnen de toegestane scope
 * (self voor een Coach, alles voor Beheerder/Admin) mag verder verfijnd
 * worden op een specifieke medewerker of groep (bv. "Structuur A").
 */
function resolveCustomerOwnerWhere(
  scope: string[] | null,
  options?: { ownerId?: string; ownerIds?: string[] }
) {
  if (scope) return { ownerId: { in: scope } };
  if (options?.ownerIds) return { ownerId: { in: options.ownerIds } };
  if (options?.ownerId) return { ownerId: options.ownerId };
  return {};
}

/**
 * Slaat de volledige productenlijst van een lead op. Bestaande producttypes
 * worden bijgewerkt (niet verwijderd + herschapen) zodat hun gekoppelde
 * polis-lijn (zie Policy) intact blijft; een producttype dat wegvalt,
 * verwijdert zijn polis-lijn mee; een nieuw producttype krijgt automatisch
 * een nieuwe polis-lijn, met deze lead-eigenaar als standaard-medewerker.
 */
export async function saveLeadProductsAction(leadId: string, formData: FormData) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessLead(user, lead))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  const desired: { type: ProductType; amount: number; units: number }[] = [];
  for (const type of PRODUCT_TYPE_ORDER) {
    const amountRaw = String(formData.get(`amount-${type}`) ?? "").trim();
    const unitsRaw = String(formData.get(`units-${type}`) ?? "").trim();
    const amount = amountRaw ? Number(amountRaw) : 0;
    const units = unitsRaw ? Math.round(Number(unitsRaw)) : 0;
    // Een product telt enkel mee als er een bedrag groter dan 0 werd ingevuld.
    if (Number.isFinite(amount) && amount > 0) {
      desired.push({ type, amount, units: Number.isFinite(units) ? units : 0 });
    }
  }

  // isFollowUp: false — deze actie beheert enkel de "basis"-productenlijst
  // (één rij per type, via de Producten-kaart); vervolgcontracten uit
  // opvolging (addFollowUpContractAction hieronder) staan hier los van.
  const existing = await prisma.leadProduct.findMany({
    where: { leadId, isFollowUp: false },
  });
  const existingByType = new Map(existing.map((p) => [p.type, p]));
  const desiredTypes = new Set(desired.map((d) => d.type));
  const toDelete = existing.filter((p) => !desiredTypes.has(p.type));

  // Rechtstreeks een product toevoegen aan een lead die de normale funnel
  // nog niet (helemaal) doorlopen heeft, moet die lead net als de "Klant
  // toevoegen"-flow en het verslepen naar de Klant-fase meteen als klant
  // markeren — anders blijft die op bv. "Nieuwe lead" staan terwijl er al
  // een polis is (zichtbaar bij Polissen/Klanten onder beheer), maar niet
  // bij Klanten (die enkel status WON toont). Zelfde voorwaarde als bij
  // "Klant toevoegen": enkel als er ook effectief een product is.
  const wonStage =
    lead.status !== "WON" && desired.length > 0
      ? await prisma.funnelStage.findFirst({
          where: { leadType: lead.leadType, isWon: true },
        })
      : null;

  await prisma.$transaction([
    ...(toDelete.length > 0
      ? [
          prisma.leadProduct.deleteMany({
            where: { id: { in: toDelete.map((p) => p.id) } },
          }),
        ]
      : []),
    ...desired.map((d) => {
      const match = existingByType.get(d.type);
      if (match) {
        return prisma.leadProduct.update({
          where: { id: match.id },
          data: { amount: d.amount, units: d.units },
        });
      }
      return prisma.leadProduct.create({
        data: {
          leadId,
          type: d.type,
          amount: d.amount,
          units: d.units,
          policy: { create: { leadId, employeeId: lead.ownerId } },
        },
      });
    }),
    ...(wonStage
      ? [
          prisma.lead.update({
            where: { id: leadId },
            data: {
              status: "WON",
              stageId: wonStage.id,
              // Zelfde standaard als het verslepen naar de Klant-fase:
              // dossierbeheerder op wie dit deed, tenzij al eerder ingesteld.
              ...(!lead.caseManagerUserId && !lead.caseManagerSubagentId
                ? { caseManagerUserId: user.id }
                : {}),
            },
          }),
          prisma.leadStageChange.create({
            data: {
              leadId,
              fromStageId: lead.stageId,
              toStageId: wonStage.id,
              changedById: user.id,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/klanten");
  revalidatePath("/subagent");
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent/polissen");
  revalidatePath("/productie");
  revalidatePath("/dashboard");
  revalidatePath(`/funnel/${lead.leadType}`);
}

/**
 * Voegt een vervolgcontract toe bij een bestaande klant (bv. een extra
 * contract dat later uit opvolging komt) — los van de vaste, één-per-type
 * productenlijst op de Producten-kaart: hetzelfde producttype kan hier dus
 * meermaals voorkomen, elk met zijn eigen datum. Die datum bepaalt in welke
 * productiemaand dit contract meetelt (zie production.ts), niet de datum
 * waarop de klant oorspronkelijk klant werd.
 */
export async function addFollowUpContractAction(leadId: string, formData: FormData) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessLead(user, lead))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }
  if (lead.status !== "WON") {
    throw new Error("Vervolgcontracten kunnen enkel bij klanten toegevoegd worden");
  }

  const type = String(formData.get("type") ?? "") as ProductType;
  if (!PRODUCT_TYPE_ORDER.includes(type)) {
    throw new Error("Kies een geldig producttype");
  }

  const amount = Number(String(formData.get("amount") ?? "").trim());
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Vul een geldig bedrag groter dan 0 in");
  }

  const unitsRaw = String(formData.get("units") ?? "").trim();
  const units = unitsRaw ? Math.round(Number(unitsRaw)) : 0;

  const dateRaw = String(formData.get("contractDate") ?? "").trim();
  const contractDate = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();
  if (Number.isNaN(contractDate.getTime())) {
    throw new Error("Ongeldige datum");
  }

  await prisma.leadProduct.create({
    data: {
      leadId,
      type,
      amount,
      units: Number.isFinite(units) ? units : 0,
      contractDate,
      isFollowUp: true,
      policy: { create: { leadId, employeeId: lead.ownerId } },
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/klanten");
  revalidatePath("/subagent");
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent/polissen");
  revalidatePath("/productie");
  revalidatePath("/dashboard");
  revalidatePath(`/funnel/${lead.leadType}`);
}

/** Verwijdert één vervolgcontract (bv. na een vergissing) — raakt de basis-productenlijst niet aan. */
export async function deleteFollowUpContractAction(leadProductId: string) {
  const [user, product] = await Promise.all([
    requireUser(),
    prisma.leadProduct.findUnique({
      where: { id: leadProductId },
      include: { lead: true },
    }),
  ]);
  if (!product || !product.isFollowUp) {
    throw new Error("Vervolgcontract niet gevonden");
  }
  if (!(await canAccessLead(user, product.lead))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  await prisma.leadProduct.delete({ where: { id: leadProductId } });

  revalidatePath(`/leads/${product.leadId}`);
  revalidatePath("/klanten");
  revalidatePath("/subagent");
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent/polissen");
  revalidatePath("/productie");
  revalidatePath("/dashboard");
  revalidatePath(`/funnel/${product.lead.leadType}`);
}

export type CustomerSortOption = "recent" | "oldest" | "amount" | "units";

/** Klanten (gewonnen leads) met hun producten, voor het klantenoverzicht. */
export async function getCustomersForCurrentUser(options?: {
  leadType?: LeadType;
  ownerId?: string;
  ownerIds?: string[];
  search?: string;
  productType?: ProductType;
  becameCustomerFrom?: Date;
  becameCustomerTo?: Date;
  sortBy?: CustomerSortOption;
  /** Rechtstreeks naar één specifieke klant springen (bv. vanaf de leaddetailpagina) — negeert de eigenaar-scoping (blijft wel binnen de toegestane zichtbaarheid van de kijker). */
  leadId?: string;
}) {
  const user = await requireUser();
  const scope = customerOwnerScope(user);
  const trimmedSearch = options?.search?.trim();

  // Enkel binnen de toegestane scope mag verder verfijnd worden op een
  // specifieke eigenaar/groep; een Coach (scope = [zichzelf]) kan dus nooit
  // via ownerId/ownerIds naar klanten van medewerkers kijken. Bij een
  // leadId-lookup (rechtstreeks vanaf de leaddetailpagina) geef je bewust
  // geen ownerId/ownerIds mee, dus dit blijft voor Beheerder/Admin
  // onbeperkt (kan elke klant vinden) en voor een Coach/User toch beperkt
  // tot zijn eigen scope (kan geen klant van iemand anders opvragen).
  const ownerWhere = resolveCustomerOwnerWhere(scope, options);

  const customers = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: "WON",
      ...(options?.leadId ? { id: options.leadId } : {}),
      ...ownerWhere,
      ...(options?.leadType ? { leadType: options.leadType } : {}),
      ...(options?.productType
        ? { products: { some: { type: options.productType } } }
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
      owner: { select: { name: true } },
      products: true,
      caseManagerUser: { select: { id: true, name: true } },
      caseManagerSubagent: { select: { id: true, name: true } },
      stageChanges: {
        where: { toStage: { isWon: true } },
        orderBy: { changedAt: "desc" },
        take: 1,
        select: { changedAt: true },
      },
    },
  });

  // "Klant sinds" is de datum van de laatste overgang naar een gewonnen fase;
  // dat kan niet native gesorteerd/gefilterd worden door Prisma, dus gebeurt hier.
  const withComputed = customers.map((customer) => ({
    ...customer,
    becameCustomerAt: customer.stageChanges[0]?.changedAt ?? customer.updatedAt,
    totalAmount: customer.products.reduce((sum, p) => sum + Number(p.amount), 0),
    totalUnits: customer.products.reduce((sum, p) => sum + p.units, 0),
    caseManagerName:
      customer.caseManagerSubagent?.name ??
      customer.caseManagerUser?.name ??
      customer.owner.name,
  }));

  const dateFiltered = withComputed.filter((customer) => {
    if (options?.becameCustomerFrom && customer.becameCustomerAt < options.becameCustomerFrom) {
      return false;
    }
    if (options?.becameCustomerTo && customer.becameCustomerAt > options.becameCustomerTo) {
      return false;
    }
    return true;
  });

  return dateFiltered.sort((a, b) => {
    switch (options?.sortBy) {
      case "oldest":
        return a.becameCustomerAt.getTime() - b.becameCustomerAt.getTime();
      case "amount":
        return b.totalAmount - a.totalAmount;
      case "units":
        return b.totalUnits - a.totalUnits;
      case "recent":
      default:
        return b.becameCustomerAt.getTime() - a.becameCustomerAt.getTime();
    }
  });
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomersForCurrentUser>>[number];

/** Wijst de dossierbeheerder van een klant toe: een subagent, of leeg = terug naar de oorspronkelijke medewerker. */
export async function setCaseManagerAction(leadId: string, formData: FormData) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  const subagentId = String(formData.get("subagentId") ?? "").trim();

  await prisma.lead.update({
    where: { id: leadId },
    data: subagentId
      ? { caseManagerSubagentId: subagentId, caseManagerUserId: null }
      : { caseManagerSubagentId: null, caseManagerUserId: lead.caseManagerUserId ?? lead.ownerId },
  });

  revalidatePath("/klanten");
  revalidatePath("/subagent");
  revalidatePath(`/leads/${leadId}`);
}

/**
 * Wijst een klant toe aan een andere medewerker (eigenaar). Enkel
 * Beheerder/Admin mogen dit — dezelfde grens als "Bekijk klanten van", want
 * het verplaatst de klant ook uit het overzicht van de huidige eigenaar naar
 * dat van de nieuwe. De nieuwe eigenaar moet een actieve, niet-verwijderde
 * gebruiker zijn die de uitvoerder ook effectief mag toewijzen.
 */
export async function setCustomerOwnerAction(leadId: string, formData: FormData) {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    throw new Error("Enkel Beheerder/Admin mogen de eigenaar van een klant wijzigen");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");

  const newOwnerId = String(formData.get("ownerId") ?? "").trim();
  if (!newOwnerId) throw new Error("Geen nieuwe eigenaar opgegeven");
  if (newOwnerId === lead.ownerId) return;

  const newOwner = await prisma.user.findUnique({
    where: { id: newOwnerId },
    select: { id: true, deletedAt: true, active: true },
  });
  if (!newOwner || newOwner.deletedAt || !newOwner.active) {
    throw new Error("Ongeldige nieuwe eigenaar");
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { ownerId: newOwnerId },
  });

  revalidatePath("/klanten");
  revalidatePath("/subagent");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

/**
 * Corrigeert "Klant sinds" achteraf — bepaalt in welke productiemaand deze
 * klant meetelt op de doelen/ranglijsten. Nodig omdat "Klant toevoegen" en de
 * bulk-import de juiste historische datum al bij aanmaak vastleggen, maar
 * eerder aangemaakte klanten (voor die fix, of gewoon fout ingevuld) hier
 * anders geen weg terug hebben. Past de meest recente "naar Klant"-
 * stage-overgang aan; niet Lead.createdAt, want dat blijft het moment waarop
 * de lead zelf in het systeem kwam (kan lang vóór "klant geworden" liggen).
 */
export async function setBecameCustomerAtAction(leadId: string, formData: FormData) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  const raw = String(formData.get("becameCustomerAt") ?? "").trim();
  if (!raw) throw new Error("Kies een datum");
  const date = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Ongeldige datum");
  if (date.getTime() > Date.now()) {
    throw new Error("Datum mag niet in de toekomst liggen");
  }

  const latestWonChange = await prisma.leadStageChange.findFirst({
    where: { leadId, toStage: { isWon: true } },
    orderBy: { changedAt: "desc" },
  });
  if (!latestWonChange) {
    throw new Error("Geen 'klant geworden'-overgang gevonden voor deze lead");
  }

  await prisma.leadStageChange.update({
    where: { id: latestWonChange.id },
    data: { changedAt: date },
  });

  revalidatePath("/klanten");
  revalidatePath("/subagent");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/dashboard");
}

/** Zet de status van de belastingsaangifte van een klant. */
export async function setTaxDeclarationStatusAction(
  leadId: string,
  formData: FormData
) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  const raw = String(formData.get("status") ?? "");
  const status = (
    Object.values(TaxDeclarationStatus) as string[]
  ).includes(raw)
    ? (raw as TaxDeclarationStatus)
    : null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { taxDeclarationStatus: status },
  });

  revalidatePath("/klanten");
  revalidatePath("/subagent");
}

/** Zet de opvolgingsstatus van een klant op "Klanten onder beheer" — volledig los van de belastingsaangifte. */
export async function setFollowUpStatusAction(
  leadId: string,
  formData: FormData
) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  const raw = String(formData.get("status") ?? "");
  const status = (
    Object.values(TaxDeclarationStatus) as string[]
  ).includes(raw)
    ? (raw as TaxDeclarationStatus)
    : null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { followUpStatus: status },
  });

  revalidatePath("/subagent");
}

export type CustomerStats = {
  totalCustomers: number;
  newThisMonth: number;
  newThisYear: number;
};

/**
 * De 3 telkaarten bovenaan de Klanten-pagina (totaal klanten, nieuwe klanten
 * deze maand/dit jaar). Neemt dezelfde eigenaar-scoping (ownerId/ownerIds)
 * als de tabel eronder, zodat de kaarten altijd exact overeenkomen met wat
 * de "Bekijk klanten van"-selectie op dat moment toont.
 *
 * "Totaal maandelijks incasso" hoort hier bewust niet bij: die kaart wordt
 * in de pagina zelf berekend als som van de al-opgehaalde klantenlijst
 * (`customer.totalAmount`), zodat hij altijd exact overeenkomt met de
 * "Totale premies"-kolom in de tabel eronder, wat filters er ook actief zijn.
 */
export async function getCustomerStats(
  monthPeriod: { startDate: Date; endDate: Date },
  yearPeriod: { startDate: Date; endDate: Date },
  options?: { ownerId?: string; ownerIds?: string[] }
): Promise<CustomerStats> {
  const user = await requireUser();
  const scope = customerOwnerScope(user);
  const ownerWhere = resolveCustomerOwnerWhere(scope, options);

  const monthEnd = new Date(monthPeriod.endDate.getTime() + 1);
  const yearEnd = new Date(yearPeriod.endDate.getTime() + 1);

  // .count() telt elke stage-overgang apart; komt een lead vaker dan één keer
  // in de periode in een "gewonnen"-fase terecht (bv. per ongeluk terug- en
  // opnieuw omgezet), dan telde dat eerder dubbel. distinct op leadId telt
  // elke lead nog maar één keer, ongeacht hoeveel keer die overgang gebeurde.
  // status: "WON" zorgt dat een lead die nadien weer uit de gewonnen fase is
  // gehaald (bv. teruggezet of verloren) niet blijft meetellen als "nieuwe
  // klant" — enkel wie nu nog effectief klant is telt mee.
  const [totalCustomers, newThisMonthLeads, newThisYearLeads] = await Promise.all([
    prisma.lead.count({
      where: { deletedAt: null, status: "WON", ...ownerWhere },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        changedAt: { gte: monthPeriod.startDate, lt: monthEnd },
        lead: { deletedAt: null, status: "WON", ...ownerWhere },
      },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        changedAt: { gte: yearPeriod.startDate, lt: yearEnd },
        lead: { deletedAt: null, status: "WON", ...ownerWhere },
      },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
  ]);

  return {
    totalCustomers,
    newThisMonth: newThisMonthLeads.length,
    newThisYear: newThisYearLeads.length,
  };
}

/** Teams/structuren, voor Beheerder/Admin om via "Bekijk klanten van" een hele structuur in één keer te kiezen. */
export async function getTeamsForCustomerFilter() {
  const user = await requireUser();
  if (!canManageUsers(user)) return [];
  return prisma.team.findMany({
    select: {
      id: true,
      name: true,
      coachId: true,
      members: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
}

