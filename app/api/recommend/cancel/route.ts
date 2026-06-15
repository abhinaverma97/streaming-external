import { NextRequest, NextResponse } from "next/server";
import { cancelGeneration } from "../../_lib/recommend.js";
import { setGenerationStatus } from "../../_lib/store.js";

export async function POST(req: NextRequest) {
  try {
    const cancelled = cancelGeneration();
    await setGenerationStatus(false);

    return NextResponse.json({ success: true, cancelled });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
