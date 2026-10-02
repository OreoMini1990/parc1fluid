export const INCENTIVE_SONO = 10_000;
export const INCENTIVE_CARM = 20_000;

const MEMO_PATTERNS = /메모|나중에|오시면|해뒀|보류|pending|미정/i;

export type FluidRow = {
  service_date: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  source_line: string;
};

export type InjectionRow = {
  service_date: string | null;
  patient_name: string;
  equipment: string;
  chart_no: string;
  room_no: number | null;
  detail: string;
  incentive_amount: number;
  status: string;
};

export function normalizeEquipment(raw: string): string {
  const s = (raw || "").trim().toUpperCase();
  if (["S", "SONO", "소노"].includes(s)) return "S";
  if (["C", "C-ARM", "CARM", "씨암"].includes(s)) return "C";
  if (s.startsWith("S")) return "S";
  if (s.startsWith("C")) return "C";
  return s || "";
}

export function incentiveAmount(equipment: string): number {
  const eq = normalizeEquipment(equipment);
  if (eq === "S") return INCENTIVE_SONO;
  if (eq === "C") return INCENTIVE_CARM;
  return 0;
}

export function roomFromChart(chartNo: string): number | null {
  if (!chartNo) return null;
  const t = chartNo.trim();
  let m = t.match(/-(\d+)\s*$/);
  if (m) return parseInt(m[1], 10);
  m = t.match(/-(\d+)(?:\D|$)/);
  if (m) return parseInt(m[1], 10);
  return null;
}

function parseQuantityMultiplier(text: string): number {
  if (!text) return 1;
  const at = text.match(/(\d+)\s*@/i);
  return at ? parseFloat(at[1]) : 1;
}

function applyHalfDose(quantity: number, sourceLine: string): number {
  const line = sourceLine || "";
  if (/(?<!\d)1\s*\/\s*2(?!\d)/.test(line) || /\b0\.5\b/.test(line)) {
    if (quantity >= 1 && quantity === Math.floor(quantity)) {
      return quantity * 0.5;
    }
  }
  return quantity;
}

export function normalizeFluidItemName(name: string): string {
  const n = (name || "").trim();
  const key = n.toLowerCase().replace(/\s/g, "");
  const aliases: Record<string, string> = {
    prf30: "PRF",
    prf30cc: "PRF",
    aap2: "AAP2",
    "+v": "+V",
    백옥600: "백옥600",
    백옥1200: "백옥1200",
    글루600: "글루타치온600",
    글루1200: "글루타치온1200",
    nac: "엔에이씨",
    엔에이씨: "엔에이씨",
  };
  return aliases[key] ?? n;
}

function fluidUnitForItem(name: string): string {
  return normalizeFluidItemName(name) === "PRF" ? "count" : "ampoule";
}

function isLikelyPendingLine(line: string): boolean {
  const l = (line || "").trim();
  if (!l) return true;
  return MEMO_PATTERNS.test(l);
}

export function enrichInjectionRow(row: Record<string, unknown>): InjectionRow {
  const chart = String(row.chart_no ?? row["차트번호"] ?? "");
  const equip = normalizeEquipment(String(row.equipment ?? row["시술장비"] ?? ""));
  let room = row.room_no ?? row["진료실"];
  if (room === null || room === undefined || room === "") {
    room = roomFromChart(chart);
  }
  let status = String(row.status ?? "approved");
  if (row.parse_status === "pending") status = "pending";
  const roomNum =
    room !== null && room !== undefined && String(room).trim() !== ""
      ? parseInt(String(room), 10)
      : null;
  return {
    patient_name: String(row.patient_name ?? row["환자이름"] ?? "").trim(),
    equipment: equip,
    chart_no: chart.trim(),
    room_no: roomNum !== null && !Number.isNaN(roomNum) ? roomNum : null,
    detail: String(row.detail ?? row["시술상세"] ?? "").trim(),
    incentive_amount: incentiveAmount(equip),
    status,
    service_date: String(row.service_date ?? row["날짜"] ?? "").trim() || null,
  };
}

export function enrichFluidRow(row: Record<string, unknown>): FluidRow {
  const name = normalizeFluidItemName(String(row.item_name ?? row["품목"] ?? ""));
  let qty = parseFloat(String(row.quantity ?? row["수량"] ?? 0));
  if (Number.isNaN(qty)) qty = 0;
  const source = String(row.source_line ?? row["원문"] ?? "");
  qty = applyHalfDose(qty, source);
  const mult = parseQuantityMultiplier(source);
  if (mult !== 1 && source.includes("@")) {
    qty = qty <= 1 ? Math.max(qty, mult) : qty;
  }
  let status = String(row.status ?? "approved");
  if (row.parse_status === "pending" || isLikelyPendingLine(source)) status = "pending";
  return {
    item_name: name,
    quantity: qty,
    unit: String(row.unit ?? fluidUnitForItem(name)),
    service_date: String(row.service_date ?? row["날짜"] ?? "").trim() || null,
    source_line: source,
    status,
  };
}

export const DEFAULT_SAFETY_STOCK: Record<string, number> = {
  PRF: 20,
  AAP2: 30,
  "+V": 30,
  백옥600: 10,
  백옥1200: 10,
  신데렐라: 10,
  글루타치온600: 10,
  글루타치온1200: 10,
  네포팜: 10,
  메박신: 10,
  라이넥: 10,
  이부프로펜: 10,
  케톨락: 10,
  엔에이씨: 10,
};
