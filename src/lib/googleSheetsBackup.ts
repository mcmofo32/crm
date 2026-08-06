import type { sheets_v4 } from "googleapis";
import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/tokenCrypto";
import { SHEETS_BACKUP_TABS } from "@/lib/sheetsBackupTabs";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
];

const SPREADSHEET_TITLE = "CRM back-up";
const PLACEHOLDER_SHEET_TITLE = "_init";

const HEADER_BACKGROUND = { red: 0.06, green: 0.09, blue: 0.16 };
const HEADER_TEXT = { red: 1, green: 1, blue: 1 };
const BAND_COLOR = { red: 0.95, green: 0.96, blue: 0.98 };

// `googleapis` is only needed by the handful of requests that actually touch
// Google Sheets, so it's imported lazily to keep it out of the server bundle
// for every route (zelfde reden als bij googleCalendar.ts).
async function getGoogle() {
  const { google } = await import("googleapis");
  return google;
}

async function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Sheets back-up is niet geconfigureerd (GOOGLE_CLIENT_ID/SECRET/GOOGLE_SHEETS_REDIRECT_URI ontbreken)."
    );
  }

  const google = await getGoogle();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Bouwt de consent-URL waarmee een Beheerder de back-up-koppeling activeert. */
export async function getGoogleSheetsConsentUrl(state: string) {
  const client = await getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    scope: SCOPES,
    state,
  });
}

async function getActiveConnection() {
  return prisma.googleSheetsBackup.findFirst({ where: { active: true } });
}

export async function getGoogleSheetsBackupStatus() {
  const connection = await getActiveConnection();
  if (!connection) {
    return { connected: false as const };
  }
  return {
    connected: true as const,
    email: connection.connectedEmail,
    spreadsheetUrl: connection.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${connection.spreadsheetId}`
      : null,
    lastSyncedAt: connection.lastSyncedAt,
    lastSyncError: connection.lastSyncError,
  };
}

/** Ruilt de OAuth-code na consent in voor tokens en activeert de back-up-koppeling. */
export async function connectGoogleSheetsBackup(userId: string, code: string) {
  const client = await getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Geen refresh token ontvangen van Google. Verwijder de app-toegang bij Google en probeer opnieuw (prompt=consent)."
    );
  }

  client.setCredentials(tokens);
  const google = await getGoogle();
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();

  const existing = await prisma.googleSheetsBackup.findFirst();
  const data = {
    active: true,
    connectedByUserId: userId,
    connectedEmail: profile.email ?? "",
    refreshToken: encryptToken(tokens.refresh_token),
    lastSyncError: null,
  };

  if (existing) {
    await prisma.googleSheetsBackup.update({ where: { id: existing.id }, data });
  } else {
    await prisma.googleSheetsBackup.create({ data });
  }
}

/**
 * Ontkoppelt de back-up volledig. Bij opnieuw verbinden wordt een nieuw
 * Google Sheets-bestand aangemaakt (het vorige blijft gewoon bestaan in de
 * Drive van wie er toen mee verbonden was).
 */
export async function disconnectGoogleSheetsBackup() {
  await prisma.googleSheetsBackup.deleteMany({});
}

async function getSheetsClient(refreshTokenEncrypted: string) {
  const client = await getOAuthClient();
  client.setCredentials({ refresh_token: decryptToken(refreshTokenEncrypted) });
  const google = await getGoogle();
  return google.sheets({ version: "v4", auth: client });
}

async function ensureSpreadsheet(
  sheets: sheets_v4.Sheets,
  connection: { id: string; spreadsheetId: string | null }
): Promise<string> {
  if (connection.spreadsheetId) return connection.spreadsheetId;

  const { data } = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SPREADSHEET_TITLE },
      sheets: [{ properties: { title: PLACEHOLDER_SHEET_TITLE } }],
    },
  });
  const spreadsheetId = data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Google Sheets gaf geen spreadsheet-id terug bij het aanmaken.");
  }

  await prisma.googleSheetsBackup.update({
    where: { id: connection.id },
    data: { spreadsheetId },
  });
  return spreadsheetId;
}

/** Formatteert en vult één tabblad volledig opnieuw (headerrij, opmaak, banding). */
async function writeTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  existingBandedRangeIds: number[],
  tab: { name: string; headers: string[]; fetchRows: () => Promise<(string | number | null)[][]> }
) {
  const rows = await tab.fetchRows();
  const values = [tab.headers, ...rows];
  const columnCount = Math.max(tab.headers.length, 1);
  const rowCount = values.length;

  // Wis eerst alle bestaande waarden zodat verwijderde/verschoven rijen niet
  // blijven hangen van een vorige sync.
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tab.name}'!A:ZZ`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab.name}'!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });

  const requests: sheets_v4.Schema$Request[] = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BACKGROUND,
            textFormat: { bold: true, foregroundColor: HEADER_TEXT },
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: columnCount },
      },
    },
    // Oude banding eerst weg, anders stapelt die op bij elke sync.
    ...existingBandedRangeIds.map((bandedRangeId) => ({ deleteBanding: { bandedRangeId } })),
  ];

  if (rowCount > 1) {
    requests.push({
      addBanding: {
        bandedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: columnCount,
          },
          rowProperties: {
            headerColor: HEADER_BACKGROUND,
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: BAND_COLOR,
          },
        },
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

/**
 * Synchroniseert alle CRM-data naar het gekoppelde Google Sheets-bestand: één
 * tabblad per model, volledig herschreven met een verzorgde opmaak. Wordt
 * zowel handmatig ("Nu synchroniseren") als door de nachtelijke cron gebruikt.
 */
export async function syncGoogleSheetsBackupNow(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const connection = await getActiveConnection();
  if (!connection) {
    return { ok: false, error: "Geen actieve Google Sheets-koppeling." };
  }

  try {
    const sheets = await getSheetsClient(connection.refreshToken);
    const spreadsheetId = await ensureSpreadsheet(sheets, connection);

    const { data: meta } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties(sheetId,title),bandedRanges(bandedRangeId))",
    });
    const existingSheets = new Map<string, number>();
    const existingBanding = new Map<number, number[]>();
    for (const sheet of meta.sheets ?? []) {
      const title = sheet.properties?.title;
      const sheetId = sheet.properties?.sheetId;
      if (title !== undefined && title !== null && sheetId !== undefined && sheetId !== null) {
        existingSheets.set(title, sheetId);
        existingBanding.set(
          sheetId,
          (sheet.bandedRanges ?? [])
            .map((b) => b.bandedRangeId)
            .filter((id): id is number => id !== undefined && id !== null)
        );
      }
    }

    // Zorg dat elk tabblad bestaat. Geen `index` meegeven: nieuwe tabbladen
    // worden dan gewoon achteraan toegevoegd, in de volgorde van de
    // requests — bij de allereerste sync komt dat overeen met de volgorde
    // van SHEETS_BACKUP_TABS.
    const addRequests: sheets_v4.Schema$Request[] = SHEETS_BACKUP_TABS.filter(
      (tab) => !existingSheets.has(tab.name)
    ).map((tab) => ({
      addSheet: {
        properties: { title: tab.name, gridProperties: { frozenRowCount: 1 } },
      },
    }));

    if (addRequests.length > 0) {
      const { data: addResult } = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: addRequests },
      });
      for (const reply of addResult.replies ?? []) {
        const props = reply.addSheet?.properties;
        if (props?.title && props.sheetId !== undefined && props.sheetId !== null) {
          existingSheets.set(props.title, props.sheetId);
        }
      }
    }

    // De placeholder-sheet (enkel nodig bij het aanmaken) is nu overbodig.
    const placeholderId = existingSheets.get(PLACEHOLDER_SHEET_TITLE);
    if (placeholderId !== undefined && existingSheets.size > 1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteSheet: { sheetId: placeholderId } }] },
      });
      existingSheets.delete(PLACEHOLDER_SHEET_TITLE);
    }

    for (const tab of SHEETS_BACKUP_TABS) {
      const sheetId = existingSheets.get(tab.name);
      if (sheetId === undefined) continue;
      await writeTab(sheets, spreadsheetId, sheetId, existingBanding.get(sheetId) ?? [], tab);
    }

    await prisma.googleSheetsBackup.update({
      where: { id: connection.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    await prisma.googleSheetsBackup.update({
      where: { id: connection.id },
      data: { lastSyncError: message },
    });
    return { ok: false, error: message };
  }
}
