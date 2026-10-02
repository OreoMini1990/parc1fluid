import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase-server";
import type { FluidRow, InjectionRow } from "@/lib/rules";
import { enrichFluidRow, enrichInjectionRow } from "@/lib/rules";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      rawText?: string;
      fluids?: FluidRow[];
      injections?: InjectionRow[];
    };
    const supabase = getSupabase();
    const preview = (body.rawText || "").slice(0, 500);

    const { data: batch, error: batchErr } = await supabase
      .from("parse_batches")
      .insert({ raw_text_preview: preview })
      .select("id")
      .single();
    if (batchErr) throw batchErr;

    const batchId = batch.id as number;
    const fluids = (body.fluids || []).map((f) => enrichFluidRow(f as unknown as Record<string, unknown>));
    const injections = (body.injections || []).map((i) => {
      const enriched = enrichInjectionRow(i as unknown as Record<string, unknown>);
      const manual = (i as InjectionRow).incentive_amount;
      if (manual !== undefined && manual !== null && !Number.isNaN(Number(manual))) {
        enriched.incentive_amount = Number(manual);
      }
      return enriched;
    });

    const fluidRows = fluids
      .filter((f) => f.status !== "pending")
      .map((f) => ({
        batch_id: batchId,
        service_date: f.service_date,
        item_name: f.item_name,
        quantity: f.quantity,
        unit: f.unit,
        status: f.status,
        source_line: f.source_line,
      }));
    if (fluidRows.length) {
      const { error } = await supabase.from("fluid_usage").insert(fluidRows);
      if (error) throw error;
    }

    const injRows = injections
      .filter((i) => i.status !== "pending")
      .map((i) => ({
        batch_id: batchId,
        service_date: i.service_date,
        patient_name: i.patient_name,
        equipment: i.equipment,
        chart_no: i.chart_no,
        room_no: i.room_no,
        detail: i.detail,
        incentive_amount: i.incentive_amount,
        status: i.status,
      }));
    if (injRows.length) {
      const { error } = await supabase.from("injection_records").insert(injRows);
      if (error) throw error;
    }

    return NextResponse.json({
      batchId,
      savedFluids: fluidRows.length,
      savedInjections: injRows.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
