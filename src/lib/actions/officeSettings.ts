"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageSettings } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { logAudit } from "@/lib/audit";

/**
 * Eén globale rij (zie schema.prisma) met het standaardadres voor een
 * fysieke afspraak en de vaste notitie die daarbij automatisch toegevoegd
 * wordt. Elke ingelogde gebruiker mag dit uitlezen (nodig bij het inplannen
 * van een afspraak) — enkel aanpassen is Beheerder-only, zie
 * updateOfficeSettingsAction.
 */
export async function getOfficeSettings() {
  return prisma.officeSettings.findFirst();
}

export async function updateOfficeSettingsAction(formData: FormData) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageSettings(viewer)) {
    throw new Error("Enkel de Beheerder mag de kantoorinstellingen aanpassen");
  }

  const address = String(formData.get("address") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;

  const existing = await prisma.officeSettings.findFirst();
  const settings = existing
    ? await prisma.officeSettings.update({
        where: { id: existing.id },
        data: { address, note },
      })
    : await prisma.officeSettings.create({ data: { address, note } });

  await logAudit({
    actorId: viewer.id,
    action: "office_settings.updated",
    entityType: "OfficeSettings",
    entityId: settings.id,
    description: "Kantoorinstellingen (adres/notitie) aangepast",
  });

  revalidatePath("/beheer/kantoor");
}
