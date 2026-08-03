"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  ProductType,
  LeadType,
  TaxDeclarationStatus,
} from "@/generated/prisma/client";
import { canAccessOwner, getVisibleUserIds, canManageUsers } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { PRODUCT_TYPE_ORDER } from "@/lib/productTypes";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/** Slaat de volledige productenlijst van een lead op (vervangt de bestaande rijen). */
export async function saveLeadProductsAction(leadId: string, formData: FormData) {
  const user = await requireUser();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
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
  const ids = await getVisibleUserIds(user);
  const trimmedSearch = options?.search?.trim();

  const customers = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: "WON",
      ...(ids ? { ownerId: { in: ids } } : {}),
      ...(options?.leadType ? { leadType: options.leadType } : {}),
      ...(options?.ownerIds
        ? { ownerId: { in: options.ownerIds } }
        : options?.ownerId
        ? { ownerId: options.ownerId }
        : {}),
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
  monthlyPremiumTotal: number;
};

/** De 4 kaarten bovenaan de Klanten-pagina. */
export async function getCustomerStats(
  monthPeriod: { startDate: Date; endDate: Date },
  yearPeriod: { startDate: Date; endDate: Date }
): Promise<CustomerStats> {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  const ownerWhere = ids ? { ownerId: { in: ids } } : {};

  const monthEnd = new Date(monthPeriod.endDate.getTime() + 1);
  const yearEnd = new Date(yearPeriod.endDate.getTime() + 1);

  const [totalCustomers, newThisMonth, newThisYear, products] =
    await Promise.all([
      prisma.lead.count({
        where: { deletedAt: null, status: "WON", ...ownerWhere },
      }),
      prisma.leadStageChange.count({
        where: {
          toStage: { isWon: true },
          changedAt: { gte: monthPeriod.startDate, lt: monthEnd },
          lead: { deletedAt: null, ...ownerWhere },
        },
      }),
      prisma.leadStageChange.count({
        where: {
          toStage: { isWon: true },
          changedAt: { gte: yearPeriod.startDate, lt: yearEnd },
          lead: { deletedAt: null, ...ownerWhere },
        },
      }),
      prisma.leadProduct.findMany({
        where: {
          lead: { deletedAt: null, status: "WON", ...ownerWhere },
        },
        select: { amount: true },
      }),
    ]);

  const monthlyPremiumTotal = products.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  return { totalCustomers, newThisMonth, newThisYear, monthlyPremiumTotal };
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** De actieve "dit jaar"-periode voor de Klanten-statistieken, of het huidige kalenderjaar als er nog niets is ingesteld. */
export async function getCurrentCustomerYearPeriod() {
  const period = await prisma.customerYearPeriod.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (period) {
    return { startDate: period.startDate, endDate: period.endDate };
  }
  const now = new Date();
  return {
    startDate: new Date(now.getFullYear(), 0, 1),
    endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
  };
}

export async function getCurrentCustomerYearPeriodForInput() {
  const { startDate, endDate } = await getCurrentCustomerYearPeriod();
  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

/** Enkel Beheerder/Admin stellen in wat "dit jaar" betekent voor de Klanten-statistieken. */
export async function setCustomerYearPeriodAction(formData: FormData) {
  const user = await requireUser();
  if (!canManageUsers(user)) {
    throw new Error("Je hebt geen rechten om deze periode in te stellen");
  }

  const startRaw = String(formData.get("yearPeriodStart") ?? "");
  const endRaw = String(formData.get("yearPeriodEnd") ?? "");
  const startDate = new Date(`${startRaw}T00:00:00`);
  const endDate = new Date(`${endRaw}T23:59:59.999`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Ongeldige begin- of einddatum");
  }

  const existing = await prisma.customerYearPeriod.findFirst();
  if (existing) {
    await prisma.customerYearPeriod.update({
      where: { id: existing.id },
      data: { startDate, endDate },
    });
  } else {
    await prisma.customerYearPeriod.create({ data: { startDate, endDate } });
  }

  revalidatePath("/klanten");
}
