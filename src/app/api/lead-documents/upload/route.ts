import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canAccessOwner, canManageCustomerData } from "@/lib/permissions";
import { LeadDocumentKind } from "@/generated/prisma/client";
import { LEAD_DOCUMENT_MAX_BYTES } from "@/lib/leadDocuments";

// Expliciet op de Node.js-runtime (niet Edge) — generateClientTokenFromReadWriteToken
// (intern aangeroepen door handleUpload) vereist dat.
export const runtime = "nodejs";

/**
 * Autoriseert een upload vanuit LeadDocumentSlot (@vercel/blob/client) — i.t.t.
 * /api/library/upload (waar iedere Beheerder/Admin elk document mag
 * toevoegen) moet dit ook nog per lead nagaan of de kijker toegang heeft
 * tot precies déze klant (clientPayload draagt leadId/kind mee).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const viewer = await getEffectiveViewer();
        if (!viewer || !canManageCustomerData(viewer)) {
          throw new Error("Je hebt geen rechten om documenten toe te voegen");
        }

        let leadId = "";
        let kind = "";
        try {
          const payload = JSON.parse(clientPayload ?? "{}") as {
            leadId?: string;
            kind?: string;
          };
          leadId = String(payload.leadId ?? "");
          kind = String(payload.kind ?? "");
        } catch {
          throw new Error("Ongeldige aanvraag");
        }
        if (
          !leadId ||
          !(Object.values(LeadDocumentKind) as string[]).includes(kind)
        ) {
          throw new Error("Ongeldige aanvraag");
        }

        const lead = await prisma.lead.findUnique({
          where: { id: leadId },
          select: { ownerId: true, deletedAt: true },
        });
        if (!lead || lead.deletedAt) throw new Error("Klant niet gevonden");
        if (!(await canAccessOwner(viewer, lead.ownerId))) {
          throw new Error("Geen toegang tot deze klant");
        }

        return {
          maximumSizeInBytes: LEAD_DOCUMENT_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // @vercel/blob/client's upload() toont bij eender welke fout hier altijd
    // dezelfde generieke "Failed to retrieve the client token" — de
    // eigenlijke reden komt dus enkel hier in de Vercel-logs terecht, nooit
    // in de UI (zie /api/library/upload voor hetzelfde patroon).
    console.error("[lead-documents/upload] token-aanvraag mislukt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload mislukt" },
      { status: 400 }
    );
  }
}
