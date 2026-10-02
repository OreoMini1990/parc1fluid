import { google } from "googleapis";

const SHEET_HEADERS: Record<string, string[]> = {
  batches: ["batch_id", "created_at", "raw_text_preview"],
  fluid_usage: [
    "batch_id",
    "service_date",
    "item_name",
    "quantity",
    "unit",
    "status",
    "source_line",
    "created_at",
  ],
  injection_records: [
    "batch_id",
    "service_date",
    "patient_name",
    "equipment",
    "chart_no",
    "room_no",
    "detail",
    "incentive_amount",
    "status",
    "created_at",
  ],
  safety_stock: ["item_name", "min_quantity"],
};

function spreadsheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID?.trim();
  if (!id) {
    throw new Error(
      "GOOGLE_SHEETS_ID를 설정하세요. (스프레드시트 URL의 /d/ 와 /edit 사이 ID)"
    );
  }
  return id;
}

function getAuth() {
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  let key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (!email || !key) {
    throw new Error(
      "GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY(서비스 계정 JSON)를 Vercel 환경 변수에 설정하세요."
    );
  }
  key = key.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function sheetsClient() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

async function getSheetTitles(): Promise<string[]> {
  const res = await sheetsClient().spreadsheets.get({ spreadsheetId: spreadsheetId() });
  return (res.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

async function ensureSheet(tabName: string): Promise<void> {
  const headers = SHEET_HEADERS[tabName];
  if (!headers) throw new Error(`Unknown sheet tab: ${tabName}`);

  const titles = await getSheetTitles();
  const client = sheetsClient();
  const sid = spreadsheetId();

  if (!titles.includes(tabName)) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: sid,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
    await client.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    return;
  }

  const head = await client.spreadsheets.values.get({
    spreadsheetId: sid,
    range: `${tabName}!1:1`,
  });
  const row = head.data.values?.[0];
  if (!row?.length) {
    await client.spreadsheets.values.update({
      spreadsheetId: sid,
      range: `${tabName}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

export async function appendBatch(preview: string): Promise<string> {
  await ensureSheet("batches");
  const batchId = String(Date.now());
  const createdAt = new Date().toISOString();
  await appendRows("batches", [[batchId, createdAt, preview]]);
  return batchId;
}

export async function appendRows(tabName: string, rows: (string | number | null)[][]): Promise<void> {
  if (!rows.length) return;
  await ensureSheet(tabName);
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}!A:Z`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

type RowObj = Record<string, string>;

export async function readSheetObjects(tabName: string): Promise<RowObj[]> {
  await ensureSheet(tabName);
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: `${tabName}!A:Z`,
  });
  const values = res.data.values ?? [];
  if (values.length < 2) return [];
  const headers = values[0].map((h) => String(h).trim());
  const out: RowObj[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row?.length) continue;
    const obj: RowObj = {};
    headers.forEach((h, j) => {
      obj[h] = row[j] !== undefined ? String(row[j]) : "";
    });
    out.push(obj);
  }
  return out;
}

export async function replaceSheetData(
  tabName: string,
  rows: (string | number)[][]
): Promise<void> {
  await ensureSheet(tabName);
  const headers = SHEET_HEADERS[tabName];
  const sid = spreadsheetId();
  const client = sheetsClient();
  await client.spreadsheets.values.clear({
    spreadsheetId: sid,
    range: `${tabName}!A:Z`,
  });
  await client.spreadsheets.values.update({
    spreadsheetId: sid,
    range: `${tabName}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers, ...rows] },
  });
}

export function inDateRange(
  serviceDate: string | null | undefined,
  from: string | null,
  to: string | null
): boolean {
  if (!from && !to) return true;
  const d = (serviceDate || "").slice(0, 10);
  if (!d) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
