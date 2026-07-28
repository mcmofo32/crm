import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { getLeadsForCurrentUser } from "@/lib/actions/leads";
import {
  LEAD_TYPE_LABELS,
  leadStatusLabel,
} from "@/lib/roleLabels";
import { LeadType } from "@/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Niet ingelogd", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const typeParam = searchParams.get("type");
  const leadType =
    typeParam === "FA" || typeParam === "RG"
      ? (typeParam as LeadType)
      : undefined;
  const q = searchParams.get("q") ?? undefined;

  const leads = await getLeadsForCurrentUser(leadType, q);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Leads");
  sheet.columns = [
    { header: "Naam", key: "naam", width: 28 },
    { header: "Type", key: "type", width: 12 },
    { header: "Fase", key: "fase", width: 24 },
    { header: "Status", key: "status", width: 14 },
    { header: "Eigenaar", key: "eigenaar", width: 22 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Telefoon", key: "telefoon", width: 18 },
    { header: "Bedrijf", key: "bedrijf", width: 22 },
    { header: "Laatste contact", key: "laatsteContact", width: 20 },
    { header: "Volgend contact", key: "volgendContact", width: 20 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const lead of leads) {
    sheet.addRow({
      naam: `${lead.firstName} ${lead.lastName}`,
      type: LEAD_TYPE_LABELS[lead.leadType],
      fase: lead.stage.label,
      status: leadStatusLabel(lead.status, lead.leadType),
      eigenaar: lead.owner.name,
      email: lead.email ?? "",
      telefoon: lead.phone ?? "",
      bedrijf: lead.company ?? "",
      laatsteContact: lead.lastContactedAt
        ? lead.lastContactedAt.toLocaleString("nl-BE")
        : "",
      volgendContact: lead.activities[0]?.scheduledAt
        ? lead.activities[0].scheduledAt.toLocaleString("nl-BE")
        : "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
