import { prisma } from "@/lib/prisma";
import { LeadType } from "@/generated/prisma/client";

/** Stage-key van de "Nieuwe lead"-fase (defaultStage hieronder), voor beide leadtypes gelijk. */
export const NEW_LEAD_STAGE_KEY = "nieuw";

type StageSpec = {
  key: string;
  label: string;
  order: number;
  isWon?: boolean;
  isLost?: boolean;
};

type FunnelSpec = {
  /** De fase waar een nieuwe lead standaard op start, vóór die in de funnel wordt ingepland (via Pipeline). */
  defaultStage: StageSpec;
  main: StageSpec[];
  secondary: StageSpec[];
  /** Oude stage-keys die niet meer gebruikt worden; leads erop verhuizen naar `defaultStage`. */
  legacyKeys: string[];
};

const FA_SPEC: FunnelSpec = {
  defaultStage: { key: NEW_LEAD_STAGE_KEY, label: "Nieuwe lead", order: -1 },
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
  legacyKeys: ["contact", "niet_bereikbaar"],
};

const RG_SPEC: FunnelSpec = {
  defaultStage: { key: NEW_LEAD_STAGE_KEY, label: "Nieuwe lead", order: -1 },
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
  legacyKeys: ["contact", "niet_bereikbaar"],
};

function specFor(leadType: LeadType): FunnelSpec {
  return leadType === "FA" ? FA_SPEC : RG_SPEC;
}

export function funnelStageKeys(leadType: LeadType): string[] {
  const spec = specFor(leadType);
  return [...spec.main, ...spec.secondary].map((s) => s.key);
}

/**
 * De 3 "actieve" funnel-fases (bv. Financiële analyse/Adviesgesprek/
 * Opvolggesprek voor FA) — een lead met zo'n fase heeft dus een
 * ingepland/lopend contactmoment. Gebruikt om leads als "Ingepland" te
 * categoriseren op Pipeline en het leadsoverzicht.
 */
export function mainFunnelStageKeys(leadType: LeadType): string[] {
  return specFor(leadType).main.map((s) => s.key);
}

async function upsertStage(leadType: LeadType, s: StageSpec) {
  return prisma.funnelStage.upsert({
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
}

/**
 * Zorgt dat de "Nieuwe lead"-fase bestaat en geeft haar id terug. Elke
 * nieuw aangemaakte lead start hier — buiten het funnelbord — tot die via
 * Pipeline (de "+"-knop) effectief ingepland wordt in de funnel.
 */
export async function ensureDefaultPipelineStage(
  leadType: LeadType
): Promise<string> {
  const spec = specFor(leadType);
  const stage = await upsertStage(leadType, spec.defaultStage);
  return stage.id;
}

/**
 * Zorgt dat de 6 canonieke fases (3 actief + 3 eindresultaat) voor dit
 * leadtype bestaan met de juiste naam/volgorde (upsert, dus veilig om
 * telkens opnieuw te draaien), en verhuist leads die nog op een
 * vervallen, oude fase staan naar "Nieuwe lead" — zodat niemand van het
 * bord verdwijnt, maar ook niemand ongevraagd in de funnel belandt.
 */
export async function ensureFunnelStages(leadType: LeadType) {
  const spec = specFor(leadType);
  const allSpecs = [...spec.main, ...spec.secondary];

  for (const s of allSpecs) {
    await upsertStage(leadType, s);
  }
  const defaultStageId = await ensureDefaultPipelineStage(leadType);

  const legacyStages = await prisma.funnelStage.findMany({
    where: { leadType, key: { in: spec.legacyKeys } },
    select: { id: true },
  });
  if (legacyStages.length > 0) {
    await prisma.lead.updateMany({
      where: { leadType, stageId: { in: legacyStages.map((s) => s.id) } },
      data: { stageId: defaultStageId },
    });
  }
}
