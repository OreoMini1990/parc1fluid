import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const supabase = getSupabase();
    let q = supabase
      .from("injection_records")
      .select("*")
      .neq("status", "pending")
      .order("service_date", { ascending: false });
    if (from) q = q.gte("service_date", from);
    if (to) q = q.lte("service_date", to);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "조회 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
