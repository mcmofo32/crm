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
  } catch {
    return NextResponse.redirect(
      new URL("/instellingen?google_error=1", req.url)
    );
  }

  const res = NextResponse.redirect(
    new URL("/instellingen?google_connected=1", req.url)
  );
  res.cookies.delete("google_oauth_state");
  return res;
}
