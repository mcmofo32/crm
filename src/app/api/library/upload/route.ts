import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";

// Expliciet op de Node.js-runtime (niet Edge) — generateClientTokenFromReadWriteToken
// (intern aangeroepen door handleUpload) vereist dat.
export const runtime = "nodejs";

// Ruim bemeten (PowerPoints, cursusmateriaal): het bestand zelf gaat
// rechtstreeks van de browser naar Vercel Blob, dus dit loopt nooit door de
// eigen server-actielimiet (next.config.ts) — enkel deze token-aanvraag doet dat.
const MAX_LIBRARY_FILE_BYTES = 200 * 1024 * 1024; // 200 MB

/** Autoriseert een upload vanuit UploadLibraryDocumentForm (@vercel/blob/client). */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const viewer = await getEffectiveViewer();
        if (!viewer || !canViewBeheerderTools(viewer)) {
          throw new Error("Je hebt geen rechten om documenten toe te voegen");
        }
        return {
          maximumSizeInBytes: MAX_LIBRARY_FILE_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // @vercel/blob/client's upload() toont bij eender welke fout hier altijd
    // dezelfde generieke "Failed to retrieve the client token" — de
    // eigenlijke reden (bv. ontbrekende BLOB_READ_WRITE_TOKEN, geen rechten)
    // komt dus enkel hier in de Vercel-logs terecht, nooit in de UI.
    console.error("[library/upload] token-aanvraag mislukt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload mislukt" },
      { status: 400 }
    );
  }
}
