import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { avatarData: true, avatarMimeType: true },
  });

  if (!user || !user.avatarData || !user.avatarMimeType) {
    return new NextResponse("Geen profielfoto gevonden", { status: 404 });
  }

  return new NextResponse(new Uint8Array(user.avatarData), {
    headers: {
      "Content-Type": user.avatarMimeType,
      // De URL bevat al ?v=<avatarUpdatedAt> als cache-buster, dus deze
      // exacte URL kan nooit een verouderde foto teruggeven — de browser
      // mag dus onbeperkt cachen i.p.v. elk uur opnieuw op te vragen. Dit
      // component wordt op elke pagina met een ledenlijst tientallen keren
      // per keer geladen.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
