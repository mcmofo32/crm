"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  InsuranceCompany,
  PolicyStatus,
  ProductType,
  Role,
} from "@/generated/prisma/client";
import {
  canAccessOwner,
  canManageCustomerData,
  canManageUsers,
} from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/**
 * Zelfherstellend: producten die al bestonden vóór de Polissen-tab er was
 * (of die om een andere reden geen polis-lijn hebben) krijgen er hier alsnog
 * één, met de lead-eigenaar als standaard-medewerker — net zoals een nieuw
 * product er automatisch één krijgt via saveLeadProductsAction. Bijna altijd
 * een no-op (lege lijst), dus goedkoop om bij elke paginalading te draaien.
 */
async function backfillMissingPolicies() {
  const missing = await prisma.leadProduct.findMany({
    where: { policy: null },
    select: { id: true, leadId: true, lead: { select: { ownerId: true } } },
  });
  if (missing.length === 0) return;

  await prisma.$transaction(
    missing.map((lp) =>
      prisma.policy.create({
        data: { leadId: lp.leadId, leadProductId: lp.id, employeeId: lp.lead.ownerId },
      })
    )
  );
}

/** Zelfde scope als de Klanten-pagina: Coach ziet enkel zichzelf, Beheerder/Admin iedereen. */
function customerOwnerScope(user: { id: string; role: Role }): string[] | null {
  return canManageUsers(user) ? null : [user.id];
}

function resolveCustomerOwnerWhere(
  scope: string[] | null,
  options?: { ownerId?: string; ownerIds?: string[] }
) {
  if (scope) return { ownerId: { in: scope } };
  if (options?.ownerIds) return { ownerId: { in: options.ownerIds } };
  if (options?.ownerId) return { ownerId: options.ownerId };
  return {};
}

export type PolicyRow = {
  id: string;
  createdAt: Date;
  /** Wanneer de klant effectief klant werd (zelfde datum als "Klant sinds" op de Klanten-pagina) — bepaalt de productiemaand-groepering op Polissen, niet `createdAt` (dat is enkel wanneer deze polis-lijn zelf in de database ontstond). */
  becameCustomerAt: Date;
  leadId: string;
  customerFirstName: string;
  customerLastName: string;
  units: number;
  productType: ProductType;
  employeeId: string;
  employeeName: string;
  company: InsuranceCompany | null;
  status: PolicyStatus;
  easy: boolean;
  tool: boolean;
  rl: boolean;
  saFile: boolean;
  ccFile: boolean;
  ingangsdatum: Date | null;
  betaaldOp: Date | null;
};

/** Alle polis-lijnen binnen de toegestane klantenscope, met dezelfde eigenaar-/zoekfilters als de Klanten-pagina. */
export async function getPoliciesForCurrentUser(options?: {
  ownerId?: string;
  ownerIds?: string[];
  search?: string;
}): Promise<PolicyRow[]> {
  const user = await requireUser();
  await backfillMissingPolicies();
  const scope = customerOwnerScope(user);
  const ownerWhere = resolveCustomerOwnerWhere(scope, options);
  const trimmedSearch = options?.search?.trim();

  const policies = await prisma.policy.findMany({
    where: {
      lead: {
        deletedAt: null,
        ...ownerWhere,
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
      lead: {
        select: {
          firstName: true,
          lastName: true,
          updatedAt: true,
          stageChanges: {
            where: { toStage: { isWon: true } },
            orderBy: { changedAt: "desc" },
            take: 1,
            select: { changedAt: true },
          },
        },
      },
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
    becameCustomerAt: p.lead.stageChanges[0]?.changedAt ?? p.lead.updatedAt,
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

async function requireEditablePolicy(policyId: string) {
  const [user, policy] = await Promise.all([
    requireUser(),
    prisma.policy.findUnique({
      where: { id: policyId },
      include: { lead: true },
    }),
  ]);
  if (!policy) throw new Error("Polis niet gevonden");
  if (!(await canAccessOwner(user, policy.lead.ownerId))) {
    throw new Error("Geen toegang tot deze polis");
  }
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }
  return policy;
}

function revalidatePolicyPaths(leadId: string) {
  revalidatePath("/klanten/polissen");
  revalidatePath("/subagent/polissen");
  revalidatePath(`/leads/${leadId}`);
}

export async function setPolicyEmployeeAction(policyId: string, formData: FormData) {
  const policy = await requireEditablePolicy(policyId);
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  if (!employeeId) throw new Error("Kies een medewerker");

  await prisma.policy.update({ where: { id: policyId }, data: { employeeId } });
  revalidatePolicyPaths(policy.leadId);
}

export async function setPolicyCompanyAction(policyId: string, formData: FormData) {
  const policy = await requireEditablePolicy(policyId);
  const raw = String(formData.get("company") ?? "");
  const company = (Object.values(InsuranceCompany) as string[]).includes(raw)
    ? (raw as InsuranceCompany)
    : null;

  await prisma.policy.update({ where: { id: policyId }, data: { company } });
  revalidatePolicyPaths(policy.leadId);
}

export async function setPolicyStatusAction(policyId: string, formData: FormData) {
  const policy = await requireEditablePolicy(policyId);
  const raw = String(formData.get("status") ?? "");
  if (!(Object.values(PolicyStatus) as string[]).includes(raw)) {
    throw new Error("Ongeldige status");
  }

  await prisma.policy.update({
    where: { id: policyId },
    data: { status: raw as PolicyStatus },
  });
  revalidatePolicyPaths(policy.leadId);
}

const CHECKLIST_FIELDS = ["easy", "tool", "rl", "saFile", "ccFile"] as const;
type ChecklistField = (typeof CHECKLIST_FIELDS)[number];

export async function setPolicyChecklistFieldAction(
  policyId: string,
  field: ChecklistField,
  formData: FormData
) {
  const policy = await requireEditablePolicy(policyId);
  if (!CHECKLIST_FIELDS.includes(field)) throw new Error("Ongeldig veld");
  const value = formData.get(field) === "true";

  await prisma.policy.update({ where: { id: policyId }, data: { [field]: value } });
  revalidatePolicyPaths(policy.leadId);
}

const DATE_FIELDS = ["ingangsdatum", "betaaldOp"] as const;
type DateField = (typeof DATE_FIELDS)[number];

export async function setPolicyDateAction(
  policyId: string,
  field: DateField,
  formData: FormData
) {
  const policy = await requireEditablePolicy(policyId);
  if (!DATE_FIELDS.includes(field)) throw new Error("Ongeldig veld");
  const raw = String(formData.get(field) ?? "").trim();
  const value = raw ? new Date(`${raw}T00:00:00`) : null;
  if (value && Number.isNaN(value.getTime())) throw new Error("Ongeldige datum");

  await prisma.policy.update({ where: { id: policyId }, data: { [field]: value } });
  revalidatePolicyPaths(policy.leadId);
}
