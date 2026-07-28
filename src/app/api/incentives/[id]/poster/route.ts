import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const incentive = await prisma.incentive.findUnique({
    where: { id },
    select: {
      posterData: true,
      posterMimeType: true,
      posterFilename: true,
    },
  });

  if (!incentive || !incentive.posterData || !incentive.posterMimeType) {
    return new NextResponse("Geen poster gevonden", { status: 404 });
  }

  return new NextResponse(new Uint8Array(incentive.posterData), {
    headers: {
      "Content-Type": incentive.posterMimeType,
      "Content-Disposition": `inline; filename="${incentive.posterFilename ?? "poster"}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
