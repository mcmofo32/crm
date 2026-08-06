import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getAssignableUsers } from "@/lib/actions/leads";

export async function GET() {
  const viewer = await getEffectiveViewer();
  if (!viewer) {
    return new NextResponse("Niet ingelogd", { status: 401 });
  }

  const assignableUsers = await getAssignableUsers();
  // Niemand anders om aan toe te wijzen? Dan heeft een Eigenaar-kolom geen
  // nut — elke geïmporteerde rij wordt sowieso automatisch aan jezelf
  // toegewezen, net als in het bulk-formulier zelf.
  const canAssignOthers = assignableUsers.length > 1;

  const workbook = new ExcelJS.Workbook();

  const leadsSheet = workbook.addWorksheet("Leads");
  leadsSheet.columns = [
    { header: "Voornaam", key: "firstName", width: 20 },
    { header: "Achternaam", key: "lastName", width: 20 },
    { header: "E-mail", key: "email", width: 28 },
    { header: "Telefoon", key: "phone", width: 18 },
    { header: "Bron", key: "source", width: 18 },
    { header: "Type (FA/RG)", key: "type", width: 14 },
    ...(canAssignOthers
      ? [{ header: "Eigenaar", key: "owner", width: 24 }]
      : []),
  ];
  leadsSheet.getRow(1).font = { bold: true };
  leadsSheet.addRow({
    firstName: "Jan",
    lastName: "Janssens",
    email: "jan.janssens@voorbeeld.be",
    phone: "0470 12 34 56",
    source: "Aanbeveling",
    type: "FA",
    ...(canAssignOthers ? { owner: assignableUsers[0]?.name ?? "" } : {}),
  });

  if (canAssignOthers) {
    const ownersSheet = workbook.addWorksheet("Eigenaars (geldige namen)");
    ownersSheet.columns = [{ header: "Naam", key: "name", width: 28 }];
    ownersSheet.getRow(1).font = { bold: true };
    for (const u of assignableUsers) {
      ownersSheet.addRow({ name: u.name });
    }
    ownersSheet.addRow({});
    ownersSheet.addRow({
      name: "Type/Eigenaar op het Leads-tabblad zijn optioneel: laat leeg om de standaardwaarden uit het bulk-formulier te gebruiken, of vul exact zo'n naam in (en FA of RG) om die rij aan een specifieke persoon toe te wijzen.",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="leads-sjabloon.xlsx"',
    },
  });
}
