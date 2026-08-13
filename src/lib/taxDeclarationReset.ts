import { prisma } from "@/lib/prisma";

/**
 * Zet de belastingsaangifte-status van alle klanten terug op "nog te doen",
 * behalve klanten met de Boekhouder-tag (hun aangifte wordt permanent door
 * een boekhouder gedaan, dus geen jaarlijkse reset nodig). Wordt elk jaar in
 * februari via Vercel Cron uitgevoerd (zie vercel.json).
 */
export async function resetTaxDeclarationStatusForNewYear() {
  const result = await prisma.lead.updateMany({
    where: {
      deletedAt: null,
      status: "WON",
      // Prisma's `not` op een nullable kolom gebruikt "<>", wat NULL-rijen
      // uitsluit (SQL: NULL <> 'x' is niet waar) — dus expliciet ook NULL
      // meenemen zodat écht alle klanten gereset worden, behalve Boekhouder.
      OR: [
        { taxDeclarationStatus: null },
        { taxDeclarationStatus: { not: "BOEKHOUDER" } },
      ],
    },
    data: { taxDeclarationStatus: "TODO" },
  });
  return { count: result.count };
}
