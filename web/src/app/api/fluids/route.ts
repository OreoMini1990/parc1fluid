import { NextRequest, NextResponse } from "next/server";
import { inDateRange, readSheetObjects } from "@/lib/google-sheets";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const raw = await readSheetObjects("fluid_usage");
    const agg = new Map<string, { item_name: string; total_qty: number; unit: string }>();

    for (const r of raw) {
      if (r.status === "pending") continue;
      if (!inDateRange(r.service_date, from, to)) continue;
      const key = `${r.item_name}|${r.unit}`;
      const qty = parseFloat(r.quantity || "0") || 0;
      const prev = agg.get(key);
      if (prev) prev.total_qty += qty;
      else
        agg.set(key, {
          item_name: r.item_name,
          total_qty: qty,
          unit: r.unit ?? "",
        });
    }

    return NextResponse.json({
      rows: [...agg.values()].sort((a, b) => a.item_name.localeCompare(b.item_name)),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
