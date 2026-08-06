import { NextRequest, NextResponse } from "next/server";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageSettings } from "@/lib/permissions";
import { connectGoogleSheetsBackup } from "@/lib/googleSheetsBackup";

export async function GET(req: NextRequest) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canManageSettings({ id: viewer.id, role: viewer.realRole })) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_sheets_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      new URL("/beheer/backup?error=invalid_state", req.url)
    );
  }

  try {
    await connectGoogleSheetsBackup(viewer.id, code);
  } catch (error) {
    console.error("Google Sheets back-up koppelen mislukt:", error);
    return NextResponse.redirect(new URL("/beheer/backup?error=1", req.url));
  }

  const res = NextResponse.redirect(
    new URL("/beheer/backup?connected=1", req.url)
  );
  res.cookies.delete("google_sheets_oauth_state");
  return res;
}
