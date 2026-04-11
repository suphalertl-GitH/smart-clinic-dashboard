import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

function getAuth() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing Google Sheets credentials');
  return new google.auth.JWT({
    email,
    key,
    scopes: SCOPES,
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

export function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) throw new Error('Missing GOOGLE_SHEETS_SPREADSHEET_ID');
  return id;
}

export async function getSheetData(range: string): Promise<string[][]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
  });
  return (res.data.values ?? []) as string[][];
}

export async function clearAndWriteSheet(range: string, values: string[][]) {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  // Clear existing data (keep header by clearing from row 2)
  const sheetName = range.split('!')[0];
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${sheetName}!A2:Z`,
  });

  if (values.length === 0) return;

  // Write new data starting from row 2
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A2`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function appendRows(range: string, values: string[][]) {
  if (values.length === 0) return;
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function testConnection(): Promise<{ ok: boolean; title?: string; error?: string }> {
  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: 'properties.title',
    });
    return { ok: true, title: res.data.properties?.title ?? '' };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
