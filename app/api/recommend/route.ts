import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "../_lib/store.js";
import { runFullGenerationPipeline } from "../_lib/recommend.js";

export async function GET(req: NextRequest) {
  try {
    const cached = await getRecommendations();

    if (cached?.isGenerating) {
      return NextResponse.json(cached);
    }

    if (!cached || (isStale(cached) && !cached.error)) {
      startBackgroundGeneration();
      return NextResponse.json({ ...cached, isGenerating: true });
    }

    return NextResponse.json(cached);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    startBackgroundGeneration();
    return NextResponse.json({ isGenerating: true }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}

function startBackgroundGeneration() {
  runFullGenerationPipeline().catch((err) => {
    console.error("[Recommend] Background generation error:", err);
  });
}

function isStale(recs: any): boolean {
  if (!recs.generatedAt) return true;
  const twoHours = 2 * 60 * 60 * 1000;
  return Date.now() - recs.generatedAt > twoHours;
}
