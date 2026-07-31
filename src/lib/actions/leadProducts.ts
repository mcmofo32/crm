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
