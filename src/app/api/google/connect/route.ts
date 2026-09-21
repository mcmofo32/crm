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
  let consentUrl: string;
  try {
    consentUrl = await getGoogleConsentUrl(state);
  } catch {
    return NextResponse.redirect(
      new URL("/instellingen?google_error=not_configured", req.url)
    );
  }

  const res = NextResponse.redirect(consentUrl);
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Ruim bemeten: bij een niet-geverifieerde app toont Google eerst een
    // waarschuwingsscherm ("Doorgaan naar ... (onveilig)") vóór de
    // eigenlijke toestemmingsvraag — 5 minuten bleek voor sommige
    // gebruikers (account kiezen, waarschuwing lezen, 2FA) te krap, met
    // "invalid_state" (deze cookie al verlopen bij het terugkeren) tot gevolg.
    maxAge: 600,
    path: "/",
  });
  return res;
}
