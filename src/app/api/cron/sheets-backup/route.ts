import { NextRequest, NextResponse } from "next/server";
import { syncGoogleSheetsBackupNow } from "@/lib/googleSheetsBackup";

export const maxDuration = 300;

/** Nachtelijke cron (zie vercel.json) die de volledige CRM-back-up ververst. */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await syncGoogleSheetsBackupNow();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
