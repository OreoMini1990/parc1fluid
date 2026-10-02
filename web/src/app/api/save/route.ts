import { NextRequest, NextResponse } from "next/server";
import { appendBatch, appendRows } from "@/lib/google-sheets";
import type { FluidRow, InjectionRow } from "@/lib/rules";
import { enrichFluidRow, enrichInjectionRow } from "@/lib/rules";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      rawText?: string;
      fluids?: FluidRow[];
      injections?: InjectionRow[];
    };
    const preview = (body.rawText || "").slice(0, 500);
    const batchId = await appendBatch(preview);
    const now = new Date().toISOString();

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
      .map((f) => [
        batchId,
        f.service_date ?? "",
        f.item_name,
        f.quantity,
        f.unit,
        f.status,
        f.source_line,
        now,
      ]);
    await appendRows("fluid_usage", fluidRows);

    const injRows = injections
      .filter((i) => i.status !== "pending")
      .map((i) => [
        batchId,
        i.service_date ?? "",
        i.patient_name,
        i.equipment,
        i.chart_no,
        i.room_no ?? "",
        i.detail,
        i.incentive_amount,
        i.status,
        now,
      ]);
    await appendRows("injection_records", injRows);

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
