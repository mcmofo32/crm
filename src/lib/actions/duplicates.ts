import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBeheerder } from "@/lib/permissions";
import type { LeadType } from "@/generated/prisma/client";

function normalizeEmail(email: string | null) {
  return email ? email.trim().toLowerCase() : null;
}

function normalizePhone(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 6 ? digits : null;
}

class UnionFind {
  private parent = new Map<string, string>();

  private root(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let current = x;
    while (this.parent.get(current) !== current) {
      current = this.parent.get(current)!;
    }
    this.parent.set(x, current);
    return current;
  }

  union(a: string, b: string) {
    const ra = this.root(a);
    const rb = this.root(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  groupsOf(ids: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const id of ids) {
      const root = this.root(id);
      const existing = groups.get(root);
      if (existing) existing.push(id);
      else groups.set(root, [id]);
    }
    return groups;
  }
}

export type DuplicateLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  leadType: LeadType;
  stageLabel: string;
  ownerName: string;
  createdByName: string;
  createdAt: Date;
};

export type DuplicateGroup = {
  key: string;
  sharedEmails: string[];
  sharedPhones: string[];
  leads: DuplicateLead[];
};

export async function getDuplicateLeads(): Promise<DuplicateGroup[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  if (!isBeheerder(session.user)) {
    throw new Error("Enkel de Beheerder heeft toegang tot dit overzicht");
  }

  const leads = await prisma.lead.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      leadType: true,
      createdAt: true,
      stage: { select: { label: true } },
      owner: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const emailMap = new Map<string, string[]>();
  const phoneMap = new Map<string, string[]>();
  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    if (email) {
      const list = emailMap.get(email) ?? [];
      list.push(lead.id);
      emailMap.set(email, list);
    }
    const phone = normalizePhone(lead.phone);
    if (phone) {
      const list = phoneMap.get(phone) ?? [];
      list.push(lead.id);
      phoneMap.set(phone, list);
    }
  }

  const uf = new UnionFind();
  const emailsByLead = new Map<string, string>();
  const phonesByLead = new Map<string, string>();
  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    if (email) emailsByLead.set(lead.id, email);
    const phone = normalizePhone(lead.phone);
    if (phone) phonesByLead.set(lead.id, phone);
  }

  for (const ids of emailMap.values()) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i]);
  }
  for (const ids of phoneMap.values()) {
    if (ids.length < 2) continue;
    for (let i = 1; i < ids.length; i++) uf.union(ids[0], ids[i]);
  }

  const allIds = leads.map((l) => l.id);
  const groups = uf.groupsOf(allIds);
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const result: DuplicateGroup[] = [];
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue;

    const groupLeads = ids
      .map((id) => leadById.get(id)!)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const sharedEmails = new Set<string>();
    const sharedPhones = new Set<string>();
    for (const id of ids) {
      const email = emailsByLead.get(id);
      if (email && (emailMap.get(email)?.length ?? 0) > 1) sharedEmails.add(email);
      const phone = phonesByLead.get(id);
      if (phone && (phoneMap.get(phone)?.length ?? 0) > 1) sharedPhones.add(phone);
    }

    result.push({
      key: root,
      sharedEmails: Array.from(sharedEmails),
      sharedPhones: Array.from(sharedPhones),
      leads: groupLeads.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        email: l.email,
        phone: l.phone,
        leadType: l.leadType,
        stageLabel: l.stage.label,
        ownerName: l.owner.name,
        createdByName: l.createdBy.name,
        createdAt: l.createdAt,
      })),
    });
  }

  return result.sort((a, b) => b.leads.length - a.leads.length);
}
