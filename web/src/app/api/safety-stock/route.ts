import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import { DEFAULT_SAFETY_STOCK } from "@/lib/rules";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("safety_stock").select("*");
    if (error) throw error;
    if (!data?.length) {
      const seed = Object.entries(DEFAULT_SAFETY_STOCK).map(([item_name, min_quantity]) => ({
        item_name,
        min_quantity,
      }));
      await supabase.from("safety_stock").upsert(seed);
      return NextResponse.json({ items: DEFAULT_SAFETY_STOCK });
    }
    const items: Record<string, number> = {};
    for (const row of data) items[row.item_name] = Number(row.min_quantity);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items?: Record<string, number> };
    if (!items) {
      return NextResponse.json({ error: "items 필요" }, { status: 400 });
    }
    const supabase = getSupabase();
    const rows = Object.entries(items).map(([item_name, min_quantity]) => ({
      item_name,
      min_quantity,
    }));
    const { error } = await supabase.from("safety_stock").upsert(rows);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
