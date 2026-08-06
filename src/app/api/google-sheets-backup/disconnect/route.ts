import { NextRequest, NextResponse } from "next/server";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageSettings } from "@/lib/permissions";
import { disconnectGoogleSheetsBackup } from "@/lib/googleSheetsBackup";

export async function POST(req: NextRequest) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canManageSettings({ id: viewer.id, role: viewer.realRole })) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  await disconnectGoogleSheetsBackup();
  return NextResponse.redirect(new URL("/beheer/backup", req.url));
}
