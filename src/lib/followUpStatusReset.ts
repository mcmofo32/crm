import { prisma } from "@/lib/prisma";

/**
 * Het jaar dat iemand klant wordt hoeft de jaarlijkse opvolging nog niet —
 * pas vanaf een maand vóór hun eerste (en daarna elke volgende) verjaardag
 * van hun "klant sinds"-datum telt de opvolging als "nog te doen". 11
 * maanden na "klant sinds" = exact één maand vóór die verjaardag.
 */
const FOLLOW_UP_GRACE_MONTHS = 11;

function monthsSince(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Effectieve standaardstatus voor zolang er nog geen (of geen recentere) manuele status ingesteld is. */
export function defaultFollowUpStatus(
  becameCustomerAt: Date,
  now: Date = new Date()
): "NVT" | "TODO" {
  return monthsSince(becameCustomerAt, now) >= FOLLOW_UP_GRACE_MONTHS ? "TODO" : "NVT";
}

/** Bereikt deze klant deze maand hun jaarlijkse triggermaand (een maand vóór hun verjaardag, ten vroegste hun eerste)? */
function isFollowUpTriggerMonth(becameCustomerAt: Date, now: Date): boolean {
  if (monthsSince(becameCustomerAt, now) < FOLLOW_UP_GRACE_MONTHS) return false;
  const triggerMonth = (becameCustomerAt.getMonth() + FOLLOW_UP_GRACE_MONTHS) % 12;
  return now.getMonth() === triggerMonth;
}

/**
 * Zet de opvolgingsstatus op "nog te doen" voor elke klant die deze maand
 * hun jaarlijkse triggermaand bereikt — een maand vóór de verjaardag van hun
 * "klant sinds"-datum — ongeacht hun huidige status, zodat elk jaar een
 * nieuwe opvolgingscyclus herstart. Klanten in hun eerste jaar worden
 * overgeslagen (zie FOLLOW_UP_GRACE_MONTHS). Wordt maandelijks via Vercel
 * Cron uitgevoerd (zie vercel.json).
 */
export async function resetFollowUpStatusForAnniversaries(now: Date = new Date()) {
  const customers = await prisma.lead.findMany({
    where: { deletedAt: null, status: "WON" },
    select: {
      id: true,
      updatedAt: true,
      stageChanges: {
        where: { toStage: { isWon: true } },
        orderBy: { changedAt: "desc" },
        take: 1,
        select: { changedAt: true },
      },
    },
  });

  const dueIds = customers
    .filter((customer) =>
      isFollowUpTriggerMonth(customer.stageChanges[0]?.changedAt ?? customer.updatedAt, now)
    )
    .map((customer) => customer.id);

  if (dueIds.length === 0) return { count: 0 };

  const result = await prisma.lead.updateMany({
    where: { id: { in: dueIds } },
    data: { followUpStatus: "TODO" },
  });
  return { count: result.count };
}
