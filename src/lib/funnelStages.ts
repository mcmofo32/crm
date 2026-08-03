import { prisma } from "@/lib/prisma";
import { LeadType } from "@/generated/prisma/client";

type StageSpec = {
  key: string;
  label: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
};

type FunnelSpec = {
  main: StageSpec[];
  secondary: StageSpec[];
  /** Oude stage-keys die niet meer gebruikt worden; leads erop verhuizen naar de eerste hoofdfase. */
  legacyKeys: string[];
};

const FA_SPEC: FunnelSpec = {
  main: [
    { key: "financiele_analyse", label: "Financiële analyse", order: 0 },
    { key: "adviesgesprek", label: "Adviesgesprek", order: 1 },
    { key: "opvolggesprek", label: "Opvolggesprek", order: 2 },
  ],
  secondary: [
    { key: "gewonnen", label: "Klant", order: 3, isWon: true },
    { key: "verloren", label: "Geen klant", order: 4, isLost: true },
    { key: "voorstel", label: "Opvolging", order: 5 },
  ],
  legacyKeys: ["nieuw", "contact", "niet_bereikbaar"],
};

const RG_SPEC: FunnelSpec = {
  main: [
    { key: "behoefte", label: "Kennismakingsgesprek", order: 0 },
    { key: "offerte", label: "Carrièregesprek", order: 1 },
    { key: "terugkoppeling", label: "Terugkoppeling", order: 2 },
  ],
  secondary: [
    { key: "gewonnen", label: "Medewerker", order: 3, isWon: true },
    { key: "verloren", label: "Geen medewerker", order: 4, isLost: true },
    { key: "opvolging", label: "Opvolging", order: 5 },
  ],
  legacyKeys: ["nieuw", "contact", "niet_bereikbaar"],
};

function specFor(leadType: LeadType): FunnelSpec {
  return leadType === "FA" ? FA_SPEC : RG_SPEC;
}

export function funnelStageKeys(leadType: LeadType): string[] {
  const spec = specFor(leadType);
  return [...spec.main, ...spec.secondary].map((s) => s.key);
}

/**
 * Zorgt dat de 6 canonieke fases (3 actief + 3 eindresultaat) voor dit
 * leadtype bestaan met de juiste naam/volgorde (upsert, dus veilig om
 * telkens opnieuw te draaien), en verhuist leads die nog op een
 * vervallen, oude fase staan naar de eerste actieve fase — zodat niemand
 * van het bord verdwijnt.
 */
export async function ensureFunnelStages(leadType: LeadType) {
  const spec = specFor(leadType);
  const allSpecs = [...spec.main, ...spec.secondary];

  const stageIdByKey = new Map<string, string>();
  for (const s of allSpecs) {
    const stage = await prisma.funnelStage.upsert({
      where: { leadType_key: { leadType, key: s.key } },
      update: {
        label: s.label,
        order: s.order,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      },
      create: {
        leadType,
        key: s.key,
        label: s.label,
        order: s.order,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      },
    });
    stageIdByKey.set(s.key, stage.id);
  }

  const legacyStages = await prisma.funnelStage.findMany({
    where: { leadType, key: { in: spec.legacyKeys } },
    select: { id: true },
  });
  if (legacyStages.length > 0) {
    const firstMainStageId = stageIdByKey.get(spec.main[0].key)!;
    await prisma.lead.updateMany({
      where: { leadType, stageId: { in: legacyStages.map((s) => s.id) } },
      data: { stageId: firstMainStageId },
    });
  }
}
