import { NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";

// Expliciet op de Node.js-runtime (niet Edge) — generateClientTokenFromReadWriteToken
// vereist dat, en dit sluit een verkeerd geresolveerde runtime uit als oorzaak.
export const runtime = "nodejs";

/**
 * Tijdelijk diagnose-endpoint om de "Failed to retrieve the client token"-fout
 * op /bibliotheek te doorgronden: @vercel/blob/client toont in de UI altijd
 * dezelfde generieke melding, ongeacht de echte oorzaak. Bezoek deze URL
 * terwijl je ingelogd bent (als Beheerder/Admin) om de effectieve staat te
 * zien, zonder in de Vercel-logs te moeten zoeken.
 */
export async function GET() {
  const report: Record<string, unknown> = {};

  try {
    const viewer = await getEffectiveViewer();
    report.ingelogd = !!viewer;
    report.naam = viewer?.name ?? null;
    report.rol = viewer?.role ?? null;
    report.magBibliotheekBeheren = viewer ? canViewBeheerderTools(viewer) : false;
  } catch (err) {
    report.viewerFout = err instanceof Error ? err.message : String(err);
  }

  report.blobTokenAanwezig = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  try {
    const token = await generateClientTokenFromReadWriteToken({
      pathname: "diagnose-test.txt",
      allowedContentTypes: ["text/plain"],
      maximumSizeInBytes: 1024,
    });
    report.tokenGegenereerd = true;
    report.tokenLengte = token.length;
  } catch (err) {
    report.tokenGegenereerd = false;
    report.tokenFout = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(report);
}
