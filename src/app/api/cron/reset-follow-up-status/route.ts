import { NextRequest, NextResponse } from "next/server";
import { resetFollowUpStatusForAnniversaries } from "@/lib/followUpStatusReset";

export const maxDuration = 300;

/** Maandelijkse cron (zie vercel.json, elke 1e van de maand) die de opvolgingsstatus op "nog te doen" zet voor klanten wiens jaarlijkse triggermaand nu aanbreekt. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await resetFollowUpStatusForAnniversaries();
  return NextResponse.json({ ok: true, updated: result.count });
}
