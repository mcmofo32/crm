"use server";

import { prisma } from "@/lib/prisma";
import { ProductType } from "@/generated/prisma/client";
import {
  canManageCustomerData,
  canManageUsers,
  getDescendantUserIds,
} from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import type { CustomerSortOption } from "@/lib/actions/leadProducts";

async function requireSubagentPortalAccess() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageCustomerData(viewer)) {
    throw new Error(
      "Enkel subagenten (of Beheerder/Admin) hebben toegang tot dit overzicht"
    );
  }
  return viewer;
}

export type ManagedScopeOption = { id: string; name: string };

/** Individuele medewerkers om uit te kiezen bij "per persoon" — enkel voor Beheerder/Admin. */
export async function getManagedScopePersons(): Promise<ManagedScopeOption[]> {
  const viewer = await requireSubagentPortalAccess();
  if (!canManageUsers(viewer)) return [];
  return prisma.user.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Bepaalt welke Subagent-id's meetellen voor "Klanten onder beheer":
 * - Subagent (geen Beheerder/Admin): altijd verplicht enkel zichzelf.
 * - Beheerder/Admin: `personId` (één gekozen medewerker) heeft voorrang op
 *   `structureId` (een hele substructuur — zichzelf + iedereen
 *   rechtstreeks/onrechtstreeks eronder), en zonder één van beide zien ze
 *   standaard alles (`null` = geen filter, bedrijfsbreed).
 */
export async function resolveManagedSubagentIds(
  structureId?: string,
  personId?: string
): Promise<string[] | null> {
  const viewer = await requireSubagentPortalAccess();

  if (!canManageUsers(viewer)) {
    const mine = await prisma.subagent.findUnique({
      where: { userId: viewer.id },
      select: { id: true },
    });
    return mine ? [mine.id] : [];
  }

  let userIds: string[] | null = null;
  if (personId) {
    userIds = [personId];
  } else if (structureId) {
    const descendants = await getDescendantUserIds(structureId);
    userIds = [structureId, ...descendants];
  }

  if (!userIds) return null;

  const subagents = await prisma.subagent.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  return subagents.map((s) => s.id);
}

function subagentWhere(subagentIds: string[] | null) {
  // `null` = geen beperking (Beheerder/Admin zonder gekozen structuur/persoon):
  // toon elke klant die effectief een dossierbeheerder-subagent heeft.
  return subagentIds
    ? { caseManagerSubagentId: { in: subagentIds } }
    : { caseManagerSubagentId: { not: null } };
}

/** Klanten (gewonnen leads) waar één van `subagentIds` dossierbeheerder is — zelfde vorm als getCustomersForCurrentUser. */
export async function getManagedCustomers(options: {
  subagentIds: string[] | null;
  search?: string;
  productType?: ProductType;
  sortBy?: CustomerSortOption;
}) {
  await requireSubagentPortalAccess();
  const trimmedSearch = options.search?.trim();

  const customers = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: "WON",
      ...subagentWhere(options.subagentIds),
      ...(options.productType
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

  return withComputed.sort((a, b) => {
    switch (options.sortBy) {
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

export type ManagedCustomerStats = {
  totalCustomers: number;
  newThisMonth: number;
  newThisYear: number;
};

/** Telkaarten boven "Klanten onder beheer": zelfde 3 tellingen als de Klanten-pagina, binnen dezelfde scope als de lijst eronder. */
export async function getManagedCustomerStats(
  monthPeriod: { startDate: Date; endDate: Date },
  yearPeriod: { startDate: Date; endDate: Date },
  subagentIds: string[] | null
): Promise<ManagedCustomerStats> {
  await requireSubagentPortalAccess();
  const monthEnd = new Date(monthPeriod.endDate.getTime() + 1);
  const yearEnd = new Date(yearPeriod.endDate.getTime() + 1);
  const where = subagentWhere(subagentIds);

  const [totalCustomers, newThisMonthLeads, newThisYearLeads] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null, status: "WON", ...where } }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        changedAt: { gte: monthPeriod.startDate, lt: monthEnd },
        lead: { deletedAt: null, status: "WON", ...where },
      },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        changedAt: { gte: yearPeriod.startDate, lt: yearEnd },
        lead: { deletedAt: null, status: "WON", ...where },
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

/** Polis-lijnen van klanten waar één van `subagentIds` dossierbeheerder is — zelfde vorm als getPoliciesForCurrentUser. */
export async function getManagedPolicies(options: {
  subagentIds: string[] | null;
  search?: string;
}) {
  await requireSubagentPortalAccess();
  const trimmedSearch = options.search?.trim();

  const policies = await prisma.policy.findMany({
    where: {
      lead: {
        deletedAt: null,
        ...subagentWhere(options.subagentIds),
        ...(trimmedSearch
          ? {
              OR: [
                { firstName: { contains: trimmedSearch, mode: "insensitive" } },
                { lastName: { contains: trimmedSearch, mode: "insensitive" } },
              ],
            }
          : {}),
      },
    },
    select: {
      id: true,
      createdAt: true,
      leadId: true,
      lead: { select: { firstName: true, lastName: true } },
      leadProduct: { select: { type: true, units: true } },
      employeeId: true,
      employee: { select: { name: true } },
      company: true,
      status: true,
      easy: true,
      tool: true,
      rl: true,
      saFile: true,
      ccFile: true,
      ingangsdatum: true,
      betaaldOp: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return policies.map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    leadId: p.leadId,
    customerFirstName: p.lead.firstName,
    customerLastName: p.lead.lastName,
    units: p.leadProduct.units,
    productType: p.leadProduct.type,
    employeeId: p.employeeId,
    employeeName: p.employee.name,
    company: p.company,
    status: p.status,
    easy: p.easy,
    tool: p.tool,
    rl: p.rl,
    saFile: p.saFile,
    ccFile: p.ccFile,
    ingangsdatum: p.ingangsdatum,
    betaaldOp: p.betaaldOp,
  }));
}
