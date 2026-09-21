import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canAccessOwner } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * Enige manier om een klantdocument effectief op te halen — de blob zelf
 * staat in een private store, dus enkel de server (met BLOB_READ_WRITE_TOKEN)
 * kan de inhoud ophalen (zie /api/library/download/[id] voor hetzelfde
 * patroon). Toont standaard inline (bv. een PDF rechtstreeks in de browser,
 * zonder downloaden) — ?download=1 dwingt een downloadprompt af.
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
  const doc = await prisma.leadDocument.findUnique({
    where: { id },
    include: { lead: { select: { ownerId: true, deletedAt: true } } },
  });
  if (!doc || doc.lead.deletedAt) {
    return NextResponse.json({ error: "Document niet gevonden" }, { status: 404 });
  }
  if (!(await canAccessOwner(viewer, doc.lead.ownerId))) {
    return NextResponse.json({ error: "Geen toegang tot dit document" }, { status: 403 });
  }

  const result = await get(doc.blobPathname, { access: "private" });
  if (!result || !result.stream) {
    return NextResponse.json({ error: "Bestand niet gevonden in opslag" }, { status: 404 });
  }

  const forceDownload = new URL(req.url).searchParams.get("download") === "1";
  const encodedName = encodeURIComponent(doc.fileName);
  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${forceDownload ? "attachment" : "inline"}; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      "Content-Length": String(doc.fileSize),
    },
  });
}
