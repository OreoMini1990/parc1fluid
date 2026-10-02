import { NextRequest, NextResponse } from "next/server";
import { callParseLlm } from "@/lib/llm";
import { enrichFluidRow, enrichInjectionRow } from "@/lib/rules";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { rawText } = (await req.json()) as { rawText?: string };
    if (!rawText?.trim()) {
      return NextResponse.json({ error: "오더 텍스트가 비어 있습니다." }, { status: 400 });
    }
    const data = await callParseLlm(rawText.trim());
    const fluids = ((data.fluids as Record<string, unknown>[]) || []).map(enrichFluidRow);
    const injections = ((data.injections as Record<string, unknown>[]) || []).map(
      enrichInjectionRow
    );
    return NextResponse.json({
      fluids,
      injections,
      ignored_lines: data.ignored_lines || [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "파싱 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
