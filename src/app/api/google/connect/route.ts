import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoogleConsentUrl } from "@/lib/googleCalendar";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const state = randomBytes(16).toString("hex");
  const consentUrl = getGoogleConsentUrl(state);

  const res = NextResponse.redirect(consentUrl);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return res;
}
