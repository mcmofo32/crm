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

/** Slaat de volledige productenlijst van een lead op (vervangt de bestaande rijen). */
export async function saveLeadProductsAction(leadId: string, formData: FormData) {
  const user = await requireUser();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessLead(user, lead))) {
    throw new Error("Geen toegang tot deze lead");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }

  const products: { type: ProductType; amount: number; units: number }[] = [];
  for (const type of PRODUCT_TYPE_ORDER) {
    const amountRaw = String(formData.get(`amount-${type}`) ?? "").trim();
    const unitsRaw = String(formData.get(`units-${type}`) ?? "").trim();
    const amount = amountRaw ? Number(amountRaw) : 0;
    const units = unitsRaw ? Math.round(Number(unitsRaw)) : 0;
    // Een product telt enkel mee als er een bedrag groter dan 0 werd ingevuld.
    if (Number.isFinite(amount) && amount > 0) {
      products.push({ type, amount, units: Number.isFinite(units) ? units : 0 });
    }
  }

  await prisma.$transaction([
    prisma.leadProduct.deleteMany({ where: { leadId } }),
    ...products.map((p) =>
      prisma.leadProduct.create({
        data: { leadId, type: p.type, amount: p.amount, units: p.units },
      })
    ),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/klanten");
  revalidatePath(`/funnel/${lead.leadType}`);
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
}) {
  const user = await requireUser();
  const scope = customerOwnerScope(user);
  const trimmedSearch = options?.search?.trim();

  // Enkel binnen de toegestane scope mag verder verfijnd worden op een
  // specifieke eigenaar/groep; een Coach (scope = [zichzelf]) kan dus nooit
  // via ownerId/ownerIds naar klanten van medewerkers kijken.
  const ownerWhere = resolveCustomerOwnerWhere(scope, options);

  const customers = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: "WON",
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
  const user = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
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
  revalidatePath(`/leads/${leadId}`);
}

/** Zet de status van de belastingsaangifte van een klant. */
export async function setTaxDeclarationStatusAction(
  leadId: string,
  formData: FormData
) {
  const user = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
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

