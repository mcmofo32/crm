import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import type { LeadType } from "@/generated/prisma/client";

/** Stabiele sleutel voor een duplicaten-groep, los van welke lead toevallig de union-find-root is. */
function duplicateGroupSignature(leadIds: string[]): string {
  return [...leadIds].sort().join(",");
}

export function normalizeEmail(email: string | null) {
  return email ? email.trim().toLowerCase() : null;
}

export function normalizePhone(phone: string | null) {
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
  ownerId: string;
  ownerName: string;
  createdByName: string;
  createdAt: Date;
};

export type DuplicateGroup = {
  key: string;
  /** Stabiele sleutel (sorted lead-id's) — te gebruiken bij het negeren van deze groep. */
  signature: string;
  sharedEmails: string[];
  sharedPhones: string[];
  leads: DuplicateLead[];
};

/**
 * computeDuplicateGroupsUnsafe kan in theorie om eender welke reden falen
 * (een onverwachte datavorm, een db-hik, ...) — deze wrapper zorgt ervoor
 * dat zo'n fout nooit verder omhoog kan: elke aanroeper (de dubbele-leads
 * pagina, én de meldingsteller in de layout) krijgt in het slechtste geval
 * gewoon een lege lijst i.p.v. een crash, met een duidelijke console.error
 * voor in de Vercel-logs.
 */
async function computeDuplicateGroups(): Promise<DuplicateGroup[]> {
  try {
    return await computeDuplicateGroupsUnsafe();
  } catch (err) {
    console.error("[duplicates] computeDuplicateGroups volledig mislukt", err);
    return [];
  }
}

async function computeDuplicateGroupsUnsafe(): Promise<DuplicateGroup[]> {
  const [leads, dismissed] = await Promise.all([
    prisma.lead.findMany({
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
        ownerId: true,
        owner: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dismissedDuplicateGroup.findMany({ select: { signature: true } }),
  ]);
  const dismissedSignatures = new Set(dismissed.map((d) => d.signature));

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

    const signature = duplicateGroupSignature(ids);
    if (dismissedSignatures.has(signature)) continue;

    // Eén groep met een onverwacht datagat (bv. een lead waarvan de
    // gekoppelde fase/eigenaar intussen weg is) mag niet de hele pagina
    // laten crashen voor alle andere, wél-correcte groepen — vandaar per
    // groep opgevangen i.p.v. één keer rond de hele functie.
    try {
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
        signature,
        sharedEmails: Array.from(sharedEmails),
        sharedPhones: Array.from(sharedPhones),
        leads: groupLeads.map((l) => ({
          id: l.id,
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          phone: l.phone,
          leadType: l.leadType,
          stageLabel: l.stage?.label ?? "—",
          ownerId: l.ownerId,
          ownerName: l.owner?.name ?? "—",
          createdByName: l.createdBy?.name ?? "—",
          createdAt: l.createdAt,
        })),
      });
    } catch (err) {
      console.error("[duplicates] kon groep niet opbouwen, overgeslagen", {
        leadIds: ids,
        err,
      });
    }
  }

  return result.sort((a, b) => b.leads.length - a.leads.length);
}

export type ContactDuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string;
  ownerName: string;
  matchedOn: "email" | "phone";
};

/**
 * Bestaande (niet-verwijderde) leads van eender welke eigenaar die hetzelfde
 * e-mailadres of telefoonnummer hebben als opgegeven — voor de melding aan
 * wie een nieuwe lead ingeeft dat die persoon mogelijk al bestaat.
 */
export async function findLeadsByContact(
  email: string | null,
  phone: string | null,
  excludeLeadId?: string
): Promise<ContactDuplicateMatch[]> {
  const normEmail = normalizeEmail(email);
  const normPhone = normalizePhone(phone);
  if (!normEmail && !normPhone) return [];

  const candidates = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      owner: { select: { name: true } },
    },
  });

  const matches: ContactDuplicateMatch[] = [];
  for (const c of candidates) {
    if (normEmail && normalizeEmail(c.email) === normEmail) {
      matches.push({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        ownerName: c.owner.name,
        matchedOn: "email",
      });
      continue;
    }
    if (normPhone && normalizePhone(c.phone) === normPhone) {
      matches.push({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        ownerName: c.owner.name,
        matchedOn: "phone",
      });
    }
  }
  return matches;
}

export async function getDuplicateLeads(): Promise<DuplicateGroup[]> {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot dit overzicht");
  }
  return computeDuplicateGroups();
}

/**
 * Enkel de duplicaatgroepen waarbij de leads bij verschillende medewerkers
 * horen — voor de melding op het dashboard aan Beheerder/Admin. Geeft stil
 * een lege lijst terug voor wie geen toegang heeft, zodat dit veilig
 * onvoorwaardelijk opgevraagd kan worden (net als getUnverifiedPastSeminars).
 */
export async function getCrossOwnerDuplicateGroups(): Promise<DuplicateGroup[]> {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canViewBeheerderTools(viewer)) return [];

  const groups = await computeDuplicateGroups();
  return groups.filter(
    (g) => new Set(g.leads.map((l) => l.ownerId)).size > 1
  );
}

/**
 * Markeert een duplicaten-groep als "geen probleem" — verdwijnt dan uit de
 * Dubbele leads-lijst (en de meldingsbel op het dashboard) tot de
 * samenstelling van de groep verandert (bv. een nieuwe lead met dezelfde
 * contactgegevens komt erbij).
 */
export async function dismissDuplicateGroupAction(leadIds: string[]) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot dit overzicht");
  }
  if (leadIds.length < 2) throw new Error("Ongeldige duplicaten-groep");

  const signature = duplicateGroupSignature(leadIds);
  await prisma.dismissedDuplicateGroup.upsert({
    where: { signature },
    create: { signature, dismissedById: viewer.id },
    update: {},
  });

  revalidatePath("/beheer/duplicaten");
  revalidatePath("/dashboard");
}
