"use server";

import { revalidatePath } from "next/cache";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageSettings } from "@/lib/permissions";
import {
  getGoogleSheetsBackupStatus,
  syncGoogleSheetsBackupNow,
} from "@/lib/googleSheetsBackup";

async function requireBackupManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageSettings(viewer)) {
    throw new Error("Je hebt geen rechten om de Google Sheets back-up te beheren");
  }
  return viewer;
}

export async function getBackupStatusForAdmin() {
  await requireBackupManager();
  return getGoogleSheetsBackupStatus();
}

/** Handmatige "Nu synchroniseren"-knop op /beheer/backup. */
export async function triggerManualBackupSyncAction() {
  await requireBackupManager();
  await syncGoogleSheetsBackupNow();
  revalidatePath("/beheer/backup");
}
