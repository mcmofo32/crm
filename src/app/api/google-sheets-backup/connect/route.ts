import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageSettings } from "@/lib/permissions";
import { getGoogleSheetsConsentUrl } from "@/lib/googleSheetsBackup";

export async function GET(req: NextRequest) {
  const viewer = await getEffectiveViewer();
  if (!viewer || !canManageSettings({ id: viewer.id, role: viewer.realRole })) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const state = randomBytes(16).toString("hex");
  let consentUrl: string;
  try {
    consentUrl = await getGoogleSheetsConsentUrl(state);
  } catch {
    return NextResponse.redirect(
      new URL("/beheer/backup?error=not_configured", req.url)
    );
  }

  const res = NextResponse.redirect(consentUrl);
  res.cookies.set("google_sheets_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return res;
}
