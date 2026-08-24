"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { InsuranceCompany, PolicyStatus } from "@/generated/prisma/client";
import { canAccessOwner, canManageCustomerData } from "@/lib/permissions";
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
 * product er automatisch één krijgt via saveLeadProductsAction/
 * createWonLeadRecord/addFollowUpContractAction. Bijna altijd een no-op
 * (lege lijst), dus goedkoop om bij elke paginalading te draaien. Ook
 * gebruikt door getManagedPolicies (subagentPortal.ts) — dezelfde
 * gegevens, andere scoping — zodat een ontbrekende polis-lijn hersteld
 * wordt ongeacht via welke Polissen-pagina ze als eerste zichtbaar wordt.
 */
export async function backfillMissingPolicies() {
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

async function requireEditablePolicy(policyId: string) {
  const [user, policy] = await Promise.all([
    requireUser(),
    prisma.policy.findUnique({
      where: { id: policyId },
      include: {
        lead: { include: { caseManagerSubagent: { select: { userId: true } } } },
      },
    }),
  ]);
  if (!policy) throw new Error("Polis niet gevonden");
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen klantendata aanpassen");
  }
  // Toegang: ofwel via de gewone eigenaar/coach-scope (canAccessOwner),
  // ofwel als expliciet toegewezen dossierbeheerder van deze lead — zelfde
  // afleiding als managedByWhere (subagentPortal.ts), want die lijst toont
  // een subagent net deze polissen als "onder beheer" om te bewerken, ook
  // als de lead-eigenaar buiten zijn gewone owner/coach-scope valt.
  const isCaseManager =
    policy.lead.caseManagerUserId === user.id ||
    policy.lead.caseManagerSubagent?.userId === user.id;
  if (!isCaseManager && !(await canAccessOwner(user, policy.lead.ownerId))) {
    throw new Error("Geen toegang tot deze polis");
  }
  return policy;
}

function revalidatePolicyPaths(leadId: string) {
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
