import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canManageSettings } from "@/lib/permissions";
import { disconnectGoogleSheetsBackup } from "@/lib/googleSheetsBackup";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !canManageSettings(session.user)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  await disconnectGoogleSheetsBackup();
  return NextResponse.redirect(new URL("/beheer/backup", req.url));
}
