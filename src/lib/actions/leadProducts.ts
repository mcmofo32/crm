"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ProductType, LeadType } from "@/generated/prisma/client";
import { canAccessOwner, getVisibleUserIds } from "@/lib/permissions";
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

/** Klanten (gewonnen leads) met hun producten, voor het klantenoverzicht. */
export async function getCustomersForCurrentUser(options?: {
  leadType?: LeadType;
  ownerId?: string;
  ownerIds?: string[];
}) {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);

  return prisma.lead.findMany({
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
    },
    include: {
      owner: { select: { name: true } },
      products: true,
      stageChanges: {
        where: { toStage: { isWon: true } },
        orderBy: { changedAt: "desc" },
        take: 1,
        select: { changedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export type CustomerRow = Awaited<ReturnType<typeof getCustomersForCurrentUser>>[number];
