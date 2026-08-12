"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { isBeheerder } from "@/lib/permissions";

/** Logt een gebruiker geforceerd uit: hun huidige sessie wordt bij de eerstvolgende paginanavigatie ongeldig, ze moeten opnieuw via Google inloggen. Enkel de Beheerder mag dit. */
export async function forceLogoutUserAction(userId: string) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !isBeheerder(viewer)) {
    throw new Error("Enkel de Beheerder kan een sessie beëindigen");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { sessionInvalidatedAt: new Date() },
  });

  revalidatePath(`/beheer/gebruikers/${userId}`);
}
