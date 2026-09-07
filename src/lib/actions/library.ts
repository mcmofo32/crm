"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools, getAllowedLibrarySections } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { LibrarySection } from "@/generated/prisma/client";

/** Gooit een fout als `section` niet toegelaten is voor deze kijker (bv. rechtstreeks een Management-URL bezoeken zonder toegang). */
async function requireLibrarySectionAccess(section: LibrarySection) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!getAllowedLibrarySections(viewer).includes(section)) {
    throw new Error("Je hebt geen toegang tot deze sectie van de Bibliotheek");
  }
  return viewer;
}

async function requireLibraryManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen rechten om de bibliotheek te beheren");
  }
  return viewer;
}

/** Tabbladen + hun categorieën binnen één sectie, voor de mappenboom op de Bibliotheek-pagina. */
export async function getLibraryTabs(section: LibrarySection = LibrarySection.ALGEMEEN) {
  await requireLibrarySectionAccess(section);

  return prisma.libraryTab.findMany({
    where: { section },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      categories: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, _count: { select: { documents: true } } },
      },
    },
  });
}

export async function createLibraryTabAction(section: LibrarySection, formData: FormData) {
  await requireLibraryManager();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Naam is verplicht");

  const existing = await prisma.libraryTab.findUnique({
    where: { section_name: { section, name } },
  });
  if (existing) throw new Error(`Map "${name}" bestaat al`);

  const { _max } = await prisma.libraryTab.aggregate({
    where: { section },
    _max: { order: true },
  });
  await prisma.libraryTab.create({
    data: { name, section, order: (_max.order ?? -1) + 1 },
  });

  revalidatePath("/bibliotheek");
}

/** Enkel een leeg tabblad (geen categorieën meer) kan verwijderd worden. */
export async function deleteLibraryTabAction(tabId: string) {
  await requireLibraryManager();

  const tab = await prisma.libraryTab.findUnique({
    where: { id: tabId },
    select: { name: true, _count: { select: { categories: true } } },
  });
  if (!tab) throw new Error("Tabblad niet gevonden");
  if (tab._count.categories > 0) {
    throw new Error(
      `Verwijder eerst alle categorieën in "${tab.name}" voor je dit tabblad kan verwijderen`
    );
  }

  await prisma.libraryTab.delete({ where: { id: tabId } });
  revalidatePath("/bibliotheek");
}

export async function createLibraryCategoryAction(tabId: string, formData: FormData) {
  await requireLibraryManager();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Naam is verplicht");

  const tab = await prisma.libraryTab.findUnique({ where: { id: tabId } });
  if (!tab) throw new Error("Tabblad niet gevonden");

  const existing = await prisma.libraryCategory.findUnique({
    where: { tabId_name: { tabId, name } },
  });
  if (existing) throw new Error(`Categorie "${name}" bestaat al in dit tabblad`);

  const { _max } = await prisma.libraryCategory.aggregate({
    where: { tabId },
    _max: { order: true },
  });
  await prisma.libraryCategory.create({
    data: { name, tabId, order: (_max.order ?? -1) + 1 },
  });

  revalidatePath("/bibliotheek");
}

/** Enkel een lege categorie (geen documenten meer) kan verwijderd worden. */
export async function deleteLibraryCategoryAction(categoryId: string) {
  await requireLibraryManager();

  const category = await prisma.libraryCategory.findUnique({
    where: { id: categoryId },
    select: { name: true, _count: { select: { documents: true } } },
  });
  if (!category) throw new Error("Categorie niet gevonden");
  if (category._count.documents > 0) {
    throw new Error(
      `Verplaats of verwijder eerst de documenten in "${category.name}" voor je deze categorie kan verwijderen`
    );
  }

  await prisma.libraryCategory.delete({ where: { id: categoryId } });
  revalidatePath("/bibliotheek");
}

/**
 * Documenten uit categorieën waar de kijker toegang toe heeft (zie
 * getAllowedLibrarySections) — voor ALGEMEEN is dat iedereen die ingelogd is,
 * voor MANAGEMENT/SUBAGENT enkel wie daar recht op heeft. `categoryIds`
 * beperkt verder tot die categorieën (bv. alle categorieën van het actieve
 * tabblad, of net één specifiek gekozen categorie) — weggelaten geeft alles
 * terug waar toegang toe is.
 */
export async function getLibraryDocuments(categoryIds?: string[]) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  // Nooit enkel op het meegegeven categoryIds vertrouwen: een server-actie is
  // rechtstreeks aan te roepen, dus dit filter is de effectieve grens die
  // voorkomt dat iemand zonder Management/Subagent-toegang die documenten
  // toch te zien krijgt door een categoryId te raden/kopiëren.
  const allowedSections = getAllowedLibrarySections(viewer);

  return prisma.libraryDocument.findMany({
    where: {
      ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
      category: { tab: { section: { in: allowedSections } } },
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      categoryId: true,
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Slaat de metadata op nadat het bestand zelf al rechtstreeks vanuit de
 * browser naar Vercel Blob geüpload is (zie UploadLibraryDocumentForm) —
 * hier komt enkel het resultaat van die upload binnen, nooit de
 * bestandsinhoud zelf.
 */
export async function saveLibraryDocumentAction(params: {
  title: string;
  fileName: string;
  fileUrl: string;
  downloadUrl: string;
  blobPathname: string;
  mimeType: string;
  fileSize: number;
  categoryId: string;
}) {
  const viewer = await requireLibraryManager();

  const category = await prisma.libraryCategory.findUnique({
    where: { id: params.categoryId },
  });
  if (!category) throw new Error("Kies eerst een categorie");

  const title = params.title.trim() || params.fileName;

  const doc = await prisma.libraryDocument.create({
    data: {
      title,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      downloadUrl: params.downloadUrl,
      blobPathname: params.blobPathname,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      uploadedById: viewer.id,
      categoryId: params.categoryId,
    },
  });

  await logAudit({
    actorId: viewer.id,
    action: "library.document_uploaded",
    entityType: "LibraryDocument",
    entityId: doc.id,
    description: `Document "${doc.title}" toegevoegd aan de bibliotheek`,
  });

  revalidatePath("/bibliotheek");
}

export async function deleteLibraryDocumentAction(documentId: string) {
  const viewer = await requireLibraryManager();

  const doc = await prisma.libraryDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document niet gevonden");

  // Verwijder eerst het bestand zelf uit Vercel Blob — mislukt dat, dan blijft
  // de databaserij (en dus de downloadknop) ook nog staan, i.p.v. een
  // verwijzing naar een niet meer bestaand bestand achter te laten.
  await del(doc.fileUrl);
  await prisma.libraryDocument.delete({ where: { id: documentId } });

  await logAudit({
    actorId: viewer.id,
    action: "library.document_deleted",
    entityType: "LibraryDocument",
    entityId: documentId,
    description: `Document "${doc.title}" verwijderd uit de bibliotheek`,
  });

  revalidatePath("/bibliotheek");
}
