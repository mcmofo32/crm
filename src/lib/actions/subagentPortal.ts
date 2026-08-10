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
 * Bepaalt welke gebruikers-id's meetellen voor "Klanten onder beheer":
 * - `showAll` (enkel Beheerder/Admin): geen filter — heel het bedrijf.
 * - `personId` (enkel Beheerder/Admin): exact één gekozen medewerker.
 * - `structureId` (enkel Beheerder/Admin): een hele substructuur — die
 *   persoon + iedereen rechtstreeks/onrechtstreeks eronder.
 * - Standaard (iedereen, ook Beheerder/Admin zonder keuze): enkel zichzelf.
 */
export async function resolveManagedUserIds(
  structureId?: string,
  personId?: string,
  showAll?: boolean
): Promise<string[] | null> {
  const viewer = await requireSubagentPortalAccess();

  if (!canManageUsers(viewer)) return [viewer.id];
  if (personId) return [personId];
  if (structureId) return [structureId, ...(await getDescendantUserIds(structureId))];
  if (showAll) return null;
  return [viewer.id];
}

/**
 * Filtert leads op effectieve dossierbeheerder, binnen `userIds`
 * (`null` = geen filter, iedereen): dat is de toegewezen subagent indien
 * die een eigen inlogaccount heeft, anders de expliciet toegewezen
 * medewerker, anders (bij geen van beide) gewoon de lead-eigenaar — exact
 * dezelfde afleiding als `caseManagerName` elders in de app.
 */
function managedByWhere(userIds: string[] | null) {
  if (userIds === null) return {};
  return {
    OR: [
      { caseManagerUserId: { in: userIds } },
      {
        caseManagerUserId: null,
        caseManagerSubagentId: null,
        ownerId: { in: userIds },
      },
      { caseManagerSubagent: { userId: { in: userIds } } },
    ],
  };
}

/** Klanten (gewonnen leads) waar één van `userIds` effectief dossierbeheerder is — zelfde vorm als getCustomersForCurrentUser. */
export async function getManagedCustomers(options: {
  userIds: string[] | null;
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
      ...managedByWhere(options.userIds),
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
  userIds: string[] | null
): Promise<ManagedCustomerStats> {
  await requireSubagentPortalAccess();
  const monthEnd = new Date(monthPeriod.endDate.getTime() + 1);
  const yearEnd = new Date(yearPeriod.endDate.getTime() + 1);
  const where = managedByWhere(userIds);

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

/** Polis-lijnen van klanten waar één van `userIds` effectief dossierbeheerder is — zelfde vorm als getPoliciesForCurrentUser. */
export async function getManagedPolicies(options: {
  userIds: string[] | null;
  search?: string;
}) {
  await requireSubagentPortalAccess();
  const trimmedSearch = options.search?.trim();

  const policies = await prisma.policy.findMany({
    where: {
      lead: {
        deletedAt: null,
        ...managedByWhere(options.userIds),
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
