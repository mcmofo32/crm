"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canManageUsers } from "@/lib/permissions";
import { getEffectiveViewer } from "@/lib/impersonation";
import { FsmaModuleStatus, type FsmaModule } from "@/generated/prisma/client";
import { FSMA_MODULE_ORDER, type FsmaModuleRow } from "@/lib/fsmaLabels";

async function requireUserManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om FSMA-modules te beheren");
  }
  return viewer;
}

/** Alle 9 modules voor deze medewerker — ontbrekende modules (nog nooit gewijzigd) tellen als "Opleiding nog in te plannen". */
export async function getFsmaModulesForUser(userId: string): Promise<FsmaModuleRow[]> {
  await requireUserManager();
  const rows = await prisma.userFsmaModule.findMany({
    where: { userId },
    select: { module: true, status: true },
  });
  const statusByModule = new Map(rows.map((r) => [r.module, r.status]));
  return FSMA_MODULE_ORDER.map((module) => ({
    module,
    status: statusByModule.get(module) ?? "OPLEIDING_TE_PLANNEN",
  }));
}

export type FsmaOverviewRow = {
  userId: string;
  name: string;
  modules: FsmaModuleRow[];
};

/** Alle actieve medewerkers naast elkaar, elk met hun 9 modules — voor het overzicht op /beheer/fsma. */
export async function getFsmaOverview(): Promise<FsmaOverviewRow[]> {
  await requireUserManager();

  const [users, allRows] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.userFsmaModule.findMany({
      select: { userId: true, module: true, status: true },
    }),
  ]);

  const statusByUserAndModule = new Map<string, Map<string, FsmaModuleStatus>>();
  for (const row of allRows) {
    const byModule = statusByUserAndModule.get(row.userId) ?? new Map();
    byModule.set(row.module, row.status);
    statusByUserAndModule.set(row.userId, byModule);
  }

  return users.map((u) => {
    const byModule = statusByUserAndModule.get(u.id);
    return {
      userId: u.id,
      name: u.name,
      modules: FSMA_MODULE_ORDER.map((module) => ({
        module,
        status: byModule?.get(module) ?? "OPLEIDING_TE_PLANNEN",
      })),
    };
  });
}

export async function setFsmaModuleStatusAction(
  userId: string,
  fsmaModule: FsmaModule,
  formData: FormData
) {
  await requireUserManager();
  const raw = String(formData.get("status") ?? "");
  if (!(Object.values(FsmaModuleStatus) as string[]).includes(raw)) {
    throw new Error("Ongeldige status");
  }
  const status = raw as FsmaModuleStatus;

  await prisma.userFsmaModule.upsert({
    where: { userId_module: { userId, module: fsmaModule } },
    create: { userId, module: fsmaModule, status },
    update: { status },
  });

  revalidatePath(`/beheer/gebruikers/${userId}`);
  revalidatePath("/beheer/fsma");
}
