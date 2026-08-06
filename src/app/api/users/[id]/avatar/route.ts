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
      "Cache-Control": "private, max-age=3600",
    },
  });
}
