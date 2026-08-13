import { NextRequest, NextResponse } from "next/server";
import { resetTaxDeclarationStatusForNewYear } from "@/lib/taxDeclarationReset";

export const maxDuration = 300;

/** Jaarlijkse cron (zie vercel.json, elk jaar 1 februari) die de belastingsaangifte-status van alle klanten terugzet op "nog te doen". */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const result = await resetTaxDeclarationStatusForNewYear();
  return NextResponse.json({ ok: true, updated: result.count });
}
