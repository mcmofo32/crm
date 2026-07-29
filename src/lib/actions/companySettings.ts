"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageSettings } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";

const SINGLETON_ID = "singleton";

/** Bedrijfsbrede Zoom-link, gebruikt in online-afspraken. Iedereen mag deze lezen. */
export async function getZoomLink(): Promise<string | null> {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  const settings = await prisma.companySettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  return settings?.zoomLink ?? null;
}

export async function updateZoomLinkAction(formData: FormData) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageSettings(viewer)) {
    throw new Error("Je hebt geen rechten om deze instelling te wijzigen");
  }

  const zoomLink = String(formData.get("zoomLink") ?? "").trim() || null;

  await prisma.companySettings.upsert({
    where: { id: SINGLETON_ID },
    update: { zoomLink },
    create: { id: SINGLETON_ID, zoomLink },
  });

  revalidatePath("/instellingen");
}
