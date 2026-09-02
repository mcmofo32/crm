"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canViewBeheerderTools } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { logAudit } from "@/lib/audit";
import {
  normalizeEmail,
  normalizePhone,
  type DuplicateLead,
  type DuplicateGroup,
  type ContactDuplicateMatch,
  type SimpleDuplicateLead,
  type SimpleDuplicateGroup,
} from "@/lib/duplicateUtils";

/** Stabiele sleutel voor een duplicaten-groep, los van welke lead toevallig de union-find-root is. */
function duplicateGroupSignature(leadIds: string[]): string {
  return [...leadIds].sort().join(",");
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

/**
 * Sterk vereenvoudigde herschrijving van de duplicaten-lijst voor de
 * /beheer/duplicaten-pagina: geen union-find/transitieve groepen meer (enkel
 * rechtstreeks e-mail- of telefoon-matches), geen extra relaties (fase) die
 * niet strikt nodig zijn, en alles in één try/catch — bewust minimaal
 * gehouden zodat er zo weinig mogelijk kan mislopen bij het opbouwen ervan.
 */
async function computeSimpleDuplicateGroups(): Promise<SimpleDuplicateGroup[]> {
  try {
    const [leads, dismissed] = await Promise.all([
      prisma.lead.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          createdAt: true,
          owner: { select: { name: true } },
          stage: { select: { label: true, isWon: true, isLost: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dismissedDuplicateGroup.findMany({ select: { signature: true } }),
    ]);
    const dismissedSignatures = new Set(dismissed.map((d) => d.signature));

    const byEmail = new Map<string, typeof leads>();
    const byPhone = new Map<string, typeof leads>();
    for (const lead of leads) {
      const email = normalizeEmail(lead.email);
      if (email) {
        const arr = byEmail.get(email);
        if (arr) arr.push(lead);
        else byEmail.set(email, [lead]);
      }
      const phone = normalizePhone(lead.phone);
      if (phone) {
        const arr = byPhone.get(phone);
        if (arr) arr.push(lead);
        else byPhone.set(phone, [lead]);
      }
    }

    const toLead = (l: (typeof leads)[number]): SimpleDuplicateLead => ({
      id: l.id,
      firstName: l.firstName,
      lastName: l.lastName,
      ownerName: l.owner?.name || "Onbekend",
      createdAt: l.createdAt,
      stageLabel: l.stage?.label ?? "—",
      isWon: l.stage?.isWon ?? false,
      isLost: l.stage?.isLost ?? false,
    });

    const groups: SimpleDuplicateGroup[] = [];
    for (const [email, group] of byEmail) {
      if (group.length < 2) continue;
      const signature = `email:${email}`;
      if (dismissedSignatures.has(signature)) continue;
      groups.push({ key: signature, matchLabel: `E-mail: ${email}`, leads: group.map(toLead) });
    }
    for (const [phone, group] of byPhone) {
      if (group.length < 2) continue;
      const signature = `phone:${phone}`;
      if (dismissedSignatures.has(signature)) continue;
      groups.push({ key: signature, matchLabel: `Telefoon: ${phone}`, leads: group.map(toLead) });
    }
    return groups;
  } catch (err) {
    console.error("[duplicates] computeSimpleDuplicateGroups mislukt", err);
    return [];
  }
}

export async function getDuplicateLeads(): Promise<SimpleDuplicateGroup[]> {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canViewBeheerderTools(viewer)) return [];
  return computeSimpleDuplicateGroups();
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
export async function dismissDuplicateGroupAction(signature: string) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot dit overzicht");
  }
  if (!signature) throw new Error("Ongeldige duplicaten-groep");

  await prisma.dismissedDuplicateGroup.upsert({
    where: { signature },
    create: { signature, dismissedById: viewer.id },
    update: {},
  });

  revalidatePath("/beheer/duplicaten");
  revalidatePath("/dashboard");
}

/**
 * Ruimt in één keer elke duplicatengroep op waarbij de leads niet enkel
 * hetzelfde e-mailadres/telefoonnummer delen, maar ook voor de rest
 * (voornaam, achternaam, type) volledig identiek zijn — het patroon van een
 * dubbel ingediend formulier, niet toevallig gedeelde contactgegevens
 * tussen twee verschillende personen (bv. een gezin op hetzelfde
 * vast nummer). Zo'n groep wordt automatisch tot één lead herleid: de
 * oudste blijft, de rest gaat naar de prullenbak (herstelbaar). Een groep
 * waarin de namen verschillen wordt niet aangeraakt en blijft op deze
 * pagina staan voor manuele controle.
 */
export type DuplicateCleanupState = {
  deletedCount: number;
  skippedGroups: number;
} | null;

export async function bulkDeleteExactDuplicatesAction(
  _prevState: DuplicateCleanupState,
  _formData: FormData
): Promise<DuplicateCleanupState> {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot dit overzicht");
  }

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
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dismissedDuplicateGroup.findMany({ select: { signature: true } }),
  ]);
  const dismissedSignatures = new Set(dismissed.map((d) => d.signature));

  type LeadRow = (typeof leads)[number];
  const byEmail = new Map<string, LeadRow[]>();
  const byPhone = new Map<string, LeadRow[]>();
  for (const lead of leads) {
    const email = normalizeEmail(lead.email);
    if (email) {
      const arr = byEmail.get(email);
      if (arr) arr.push(lead);
      else byEmail.set(email, [lead]);
    }
    const phone = normalizePhone(lead.phone);
    if (phone) {
      const arr = byPhone.get(phone);
      if (arr) arr.push(lead);
      else byPhone.set(phone, [lead]);
    }
  }

  // Volledige identiteit van een lead — enkel leads die hier woord-voor-woord
  // hetzelfde uit komen, tellen als "dezelfde persoon nog eens ingediend".
  function identityKey(lead: LeadRow) {
    return [
      lead.firstName.trim().toLowerCase(),
      lead.lastName.trim().toLowerCase(),
      normalizeEmail(lead.email) ?? "",
      normalizePhone(lead.phone) ?? "",
      lead.leadType,
    ].join("|");
  }

  const toDeleteIds = new Set<string>();
  let skippedGroups = 0;

  function processGroup(group: LeadRow[], signature: string) {
    if (dismissedSignatures.has(signature)) return;
    if (new Set(group.map(identityKey)).size > 1) {
      skippedGroups++;
      return;
    }
    // group staat al op createdAt asc (van de leads-query hierboven) — de
    // eerste is dus de oudste, en blijft; de rest is de dubbele indiening.
    for (const extra of group.slice(1)) toDeleteIds.add(extra.id);
  }

  for (const [email, group] of byEmail) {
    if (group.length >= 2) processGroup(group, `email:${email}`);
  }
  for (const [phone, group] of byPhone) {
    if (group.length >= 2) processGroup(group, `phone:${phone}`);
  }

  if (toDeleteIds.size > 0) {
    await prisma.lead.updateMany({
      where: { id: { in: Array.from(toDeleteIds) } },
      data: { deletedAt: new Date(), deletedById: viewer.id },
    });

    await logAudit({
      actorId: viewer.id,
      action: "lead.bulk_deleted_duplicates",
      entityType: "Lead",
      entityId: "bulk",
      description: `${toDeleteIds.size} exacte dubbele leads in bulk verwijderd (naar prullenbak)`,
    });
  }

  revalidatePath("/beheer/duplicaten");
  revalidatePath("/beheer/prullenbak");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
  revalidatePath("/funnel/FA");
  revalidatePath("/funnel/RG");
  revalidatePath("/klanten");
  revalidatePath("/taken");

  return { deletedCount: toDeleteIds.size, skippedGroups };
}
