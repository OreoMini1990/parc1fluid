import { NextRequest, NextResponse } from "next/server";
import { readSheetObjects, replaceSheetData } from "@/lib/google-sheets";
import { DEFAULT_SAFETY_STOCK } from "@/lib/rules";

export const runtime = "nodejs";

export async function GET() {
  try {
    const raw = await readSheetObjects("safety_stock");
    if (!raw.length) {
      await replaceSheetData(
        "safety_stock",
        Object.entries(DEFAULT_SAFETY_STOCK).map(([item_name, min_quantity]) => [
          item_name,
          min_quantity,
        ])
      );
      return NextResponse.json({ items: DEFAULT_SAFETY_STOCK });
    }
    const items: Record<string, number> = {};
    for (const r of raw) {
      if (r.item_name) items[r.item_name] = parseFloat(r.min_quantity || "0") || 0;
    }
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
    const rows = Object.entries(items).map(([item_name, min_quantity]) => [
      item_name,
      min_quantity,
    ]);
    await replaceSheetData("safety_stock", rows);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "저장 실패";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
