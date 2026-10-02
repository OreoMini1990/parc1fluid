import { NextRequest, NextResponse } from "next/server";
import { inDateRange, readSheetObjects } from "@/lib/google-sheets";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const raw = await readSheetObjects("injection_records");
    const rows = raw
      .filter((r) => r.status !== "pending")
      .filter((r) => inDateRange(r.service_date, from, to))
      .map((r) => ({
        service_date: r.service_date || null,
        patient_name: r.patient_name,
        equipment: r.equipment,
        chart_no: r.chart_no,
        room_no: r.room_no ? parseInt(r.room_no, 10) : null,
        detail: r.detail,
        incentive_amount: parseInt(r.incentive_amount || "0", 10) || 0,
        status: r.status,
      }));
    return NextResponse.json({ rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
