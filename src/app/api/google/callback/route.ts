import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectGoogleCalendarForUser } from "@/lib/googleCalendar";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      new URL("/instellingen?google_error=invalid_state", req.url)
    );
  }

  try {
    await connectGoogleCalendarForUser(session.user.id, code);
  } catch (error) {
    console.error("Google Calendar koppelen mislukt:", error);
    // De echte reden komt anders enkel in de Vercel-logs terecht — nooit
    // zichtbaar voor de gebruiker of Beheerder zelf, dus hier ook mee in de
    // redirect (enkel error.message, geen volledige stack).
    const detail = error instanceof Error ? error.message : String(error);
    const url = new URL("/instellingen", req.url);
    url.searchParams.set("google_error", "1");
    url.searchParams.set("google_error_detail", detail.slice(0, 300));
    return NextResponse.redirect(url);
  }

  const res = NextResponse.redirect(
    new URL("/instellingen?google_connected=1", req.url)
  );
  res.cookies.delete("google_oauth_state");
  return res;
}
