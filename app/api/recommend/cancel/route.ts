import { NextRequest, NextResponse } from "next/server";
import { cancelGeneration, getActiveUserId } from "../../_lib/recommend.js";
import { setGenerationStatus } from "../../_lib/store.js";

export async function POST(req: NextRequest) {
  try {
    const activeUserId = getActiveUserId();
    const cancelled = cancelGeneration();
    if (activeUserId != null) {
      await setGenerationStatus(activeUserId, false);
    }

    return NextResponse.json({ success: true, cancelled });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}