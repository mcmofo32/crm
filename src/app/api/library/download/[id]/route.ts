import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";

export const runtime = "nodejs";

/**
 * Enige manier om een Bibliotheek-document effectief te downloaden — de blob
 * zelf staat in een private store (zie UploadLibraryDocumentForm), dus enkel
 * de server (met BLOB_READ_WRITE_TOKEN) kan de inhoud ophalen. Deze route
 * stroomt het bestand door naar wie ingelogd is, ongeacht rol (net als
 * getLibraryDocuments in lib/actions/library.ts).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getEffectiveViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.libraryDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Document niet gevonden" }, { status: 404 });
  }

  const result = await get(doc.blobPathname, { access: "private" });
  if (!result || !result.stream) {
    return NextResponse.json({ error: "Bestand niet gevonden in opslag" }, { status: 404 });
  }

  const encodedName = encodeURIComponent(doc.fileName);
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(doc.fileSize),
    },
  });
}
