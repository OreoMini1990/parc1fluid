import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const supabase = getSupabase();
    let q = supabase.from("fluid_usage").select("service_date, item_name, quantity, unit").neq("status", "pending");
    if (from) q = q.gte("service_date", from);
    if (to) q = q.lte("service_date", to);
    const { data, error } = await q;
    if (error) throw error;

    const agg = new Map<string, { item_name: string; total_qty: number; unit: string }>();
    for (const row of data ?? []) {
      const key = `${row.item_name}|${row.unit}`;
      const prev = agg.get(key);
      if (prev) prev.total_qty += Number(row.quantity);
      else
        agg.set(key, {
          item_name: row.item_name,
          total_qty: Number(row.quantity),
          unit: row.unit ?? "",
        });
    }
    return NextResponse.json({ rows: [...agg.values()].sort((a, b) => a.item_name.localeCompare(b.item_name)) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
