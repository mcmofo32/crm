import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { disconnectGoogleCalendarForUser } from "@/lib/googleCalendar";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  await disconnectGoogleCalendarForUser(session.user.id);
  return NextResponse.redirect(new URL("/instellingen", req.url));
}
