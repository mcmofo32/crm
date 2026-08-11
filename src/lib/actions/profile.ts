"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";

async function applyPasswordChange(formData: FormData) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  const user = await prisma.user.findUnique({ where: { id: viewer.id } });
  if (!user) throw new Error("Gebruiker niet gevonden");

  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirm = String(formData.get("newPasswordConfirm") ?? "");

  // Bij een verplichte eerste wachtwoordwijziging (net ingelogd met een
  // tijdelijk wachtwoord) hoeft het huidige wachtwoord niet herhaald te
  // worden; bij een vrijwillige wijziging via Instellingen wel, ter
  // bevestiging dat je nog steeds de eigenaar van de sessie bent.
  if (!user.mustChangePassword) {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error("Huidig wachtwoord is onjuist");
  }

  if (newPassword.length < 8) {
    throw new Error("Nieuw wachtwoord moet minstens 8 tekens hebben");
  }
  if (newPassword !== newPasswordConfirm) {
    throw new Error("De twee nieuwe wachtwoorden komen niet overeen");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: viewer.id },
    data: { passwordHash, mustChangePassword: false },
  });
}

/** Vrijwillige wachtwoordwijziging via Instellingen — vereist het huidige wachtwoord. */
export async function changeMyPasswordAction(formData: FormData) {
  await applyPasswordChange(formData);
  revalidatePath("/instellingen");
}

/** Verplichte eerste wachtwoordwijziging na een (reset-)login met een tijdelijk wachtwoord. */
export async function completeForcedPasswordChangeAction(formData: FormData) {
  await applyPasswordChange(formData);
  redirect("/dashboard");
}

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

const MAX_AVATAR_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/** Iedere gebruiker mag zelf een profielfoto uploaden. */
export async function updateMyAvatarAction(formData: FormData) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    throw new Error("Kies een foto om te uploaden");
  }
  if (!ALLOWED_AVATAR_TYPES.includes(photo.type)) {
    throw new Error("Profielfoto moet een JPEG-, PNG- of WebP-afbeelding zijn");
  }
  if (photo.size > MAX_AVATAR_BYTES) {
    throw new Error("Profielfoto mag maximaal 4 MB groot zijn");
  }

  const arrayBuffer = await photo.arrayBuffer();

  await prisma.user.update({
    where: { id: viewer.id },
    data: {
      avatarData: new Uint8Array(arrayBuffer),
      avatarMimeType: photo.type,
      avatarUpdatedAt: new Date(),
    },
  });

  revalidatePath("/instellingen");
  revalidatePath("/", "layout");
}

/** Verwijdert de eigen profielfoto, terugvallend op de initialen-avatar. */
export async function removeMyAvatarAction() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  await prisma.user.update({
    where: { id: viewer.id },
    data: { avatarData: null, avatarMimeType: null, avatarUpdatedAt: null },
  });

  revalidatePath("/instellingen");
  revalidatePath("/", "layout");
}
