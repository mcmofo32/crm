"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";

/** Iedere gebruiker mag zijn eigen Zoom-link instellen, net als de Google Agenda-koppeling. */
export async function updateMyZoomLinkAction(formData: FormData) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  const zoomLink = String(formData.get("zoomLink") ?? "").trim() || null;

  await prisma.user.update({
    where: { id: viewer.id },
    data: { zoomLink },
  });

  revalidatePath("/instellingen");
}
