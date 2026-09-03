"use server";

import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

async function requireLibraryManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen rechten om documenten toe te voegen of te verwijderen");
  }
  return viewer;
}

/** Iedereen die ingelogd is mag de bibliotheek raadplegen/downloaden. */
export async function getLibraryDocuments() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  return prisma.libraryDocument.findMany({
    select: {
      id: true,
      title: true,
      fileName: true,
      fileUrl: true,
      downloadUrl: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
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
}) {
  const viewer = await requireLibraryManager();

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
