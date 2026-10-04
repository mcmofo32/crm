import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAllowedLibrarySections } from "@/lib/permissions";
import { isViewOnlyLibraryMimeType } from "@/lib/libraryMedia";

export const runtime = "nodejs";

/**
 * Speelt een Bibliotheek-video af in de CRM zelf (zie LibraryVideoButton) —
 * zelfde toegangscontrole als /api/library/download/[id], maar inline en
 * met ondersteuning voor Range-aanvragen: de <video>-speler vraagt telkens
 * maar een stuk van het bestand op, zodat doorspoelen werkt (en Safari
 * speelt video zonder Range-ondersteuning helemaal niet af).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getEffectiveViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await prisma.libraryDocument.findUnique({
    where: { id },
    include: { category: { include: { tab: { select: { section: true } } } } },
  });
  if (!doc || !isViewOnlyLibraryMimeType(doc.mimeType)) {
    return NextResponse.json({ error: "Video niet gevonden" }, { status: 404 });
  }
  if (!getAllowedLibrarySections(viewer).includes(doc.category.tab.section)) {
    return NextResponse.json({ error: "Geen toegang tot deze video" }, { status: 403 });
  }

  const range = req.headers.get("range");
  const result = await get(doc.blobPathname, {
    access: "private",
    ...(range ? { headers: { Range: range } } : {}),
  });
  if (!result || !result.stream) {
    return NextResponse.json({ error: "Bestand niet gevonden in opslag" }, { status: 404 });
  }

  // Blob storage antwoordt op een Range-aanvraag met 206 + Content-Range —
  // die geven we ongewijzigd door aan de speler.
  const upstream = result.headers;
  const headers = new Headers({
    "Content-Type": doc.mimeType,
    "Content-Disposition": "inline",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });
  const contentLength = upstream.get("content-length");
  if (contentLength) headers.set("Content-Length", contentLength);
  const contentRange = upstream.get("content-range");
  if (contentRange) headers.set("Content-Range", contentRange);

  return new NextResponse(result.stream, {
    status: contentRange ? 206 : 200,
    headers,
  });
}
