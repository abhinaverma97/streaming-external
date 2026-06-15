import { NextRequest, NextResponse } from "next/server";
import { getRatings, getWatchlist, getRecommendations, saveRecommendations, setGenerationStatus, setGenerationError, getAiSettings } from "../_lib/store.js";
import { generateRecommendations, enrichWithTmdb } from "../_lib/recommend.js";

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
  setGenerationStatus(true).then(() => {
    generateAndSaveAsync().catch((err) => {
      console.error("[Recommend] Background generation error:", err);
      if (err.message === "User cancelled generation") {
        setGenerationStatus(false);
      } else {
        setGenerationError(err.message || "Failed to generate recommendations.");
      }
    });
  }).catch((err) => {
    console.error("[Recommend] Failed to set generation status:", err);
  });
}

async function generateAndSaveAsync() {
  console.log(`[Recommend] Starting generation`);
  const t0 = Date.now();

  const ratings = await getRatings();
  const watchlist = await getWatchlist();
  console.log(`[Recommend] Fetched ${Object.keys(ratings).length} ratings and ${watchlist.length} watchlist items`);

  const aiSettings = await getAiSettings();
  const raw = await generateRecommendations(ratings, watchlist, aiSettings);
  const enriched = await enrichWithTmdb(raw);
  await saveRecommendations(enriched);

  const totalMs = Date.now() - t0;
  console.log(`[Recommend] Complete in ${totalMs}ms. ${enriched.recommendedMovies.length} movies, ${enriched.recommendedTvShows.length} TV shows`);
}

function isStale(recs: any): boolean {
  if (!recs.generatedAt) return true;
  const twoHours = 2 * 60 * 60 * 1000;
  return Date.now() - recs.generatedAt > twoHours;
}
