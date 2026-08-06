import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getEffectiveViewer } from "@/lib/impersonation";

export async function GET() {
  const viewer = await getEffectiveViewer();
  if (!viewer) {
    return new NextResponse("Niet ingelogd", { status: 401 });
  }

  const workbook = new ExcelJS.Workbook();

  const leadsSheet = workbook.addWorksheet("Leads");
  leadsSheet.columns = [
    { header: "Voornaam", key: "firstName", width: 20 },
    { header: "Achternaam", key: "lastName", width: 20 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Telefoon", key: "phone", width: 18 },
    { header: "Bron", key: "source", width: 18 },
    { header: "Type (FA/RG)", key: "type", width: 14 },
  ];
  leadsSheet.getRow(1).font = { bold: true };
  leadsSheet.addRow({
    firstName: "Jan",
    lastName: "Janssens",
    email: "jan.janssens@voorbeeld.be",
    phone: "0470 12 34 56",
    source: "Aanbeveling",
    type: "FA",
  });
  leadsSheet.addRow([]);
  leadsSheet.addRow([
    "Type is optioneel: laat leeg om de standaardwaarde uit het bulk-formulier te gebruiken, of vul FA/RG in om die rij te overschrijven. Elke rij wordt automatisch aan jezelf toegewezen.",
  ]);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="leads-sjabloon.xlsx"',
    },
  });
}
