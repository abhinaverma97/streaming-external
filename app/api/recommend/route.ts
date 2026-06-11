import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../_lib/auth.js";
import { getRatings, getWatchlist, getRecommendations, saveRecommendations, setGenerationStatus, setGenerationError, getAiSettings } from "../_lib/user-db.js";
import { generateRecommendations, enrichWithTmdb } from "../_lib/recommend.js";

export async function GET(req: NextRequest) {
  try {
    const username = extractUsername(req);
    if (!username) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const cached = await getRecommendations(username);

    const isCheckOnly = req.nextUrl.searchParams.get("checkOnly") === "true";
    if (isCheckOnly) {
      if (!cached || (isStale(cached) && !cached.error && !cached.isGenerating)) {
        startBackgroundGeneration(username);
        return NextResponse.json({ generating: true });
      }
      return NextResponse.json({ generating: cached?.isGenerating || false });
    }

    if (cached?.isGenerating) {
      return NextResponse.json(cached);
    }

    if (!cached || (isStale(cached) && !cached.error)) {
      startBackgroundGeneration(username);
      return NextResponse.json({ ...cached, isGenerating: true });
    }

    return NextResponse.json(cached);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const username = extractUsername(req);
    if (!username) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    startBackgroundGeneration(username);
    return NextResponse.json({ isGenerating: true }, { status: 202 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}

function startBackgroundGeneration(username: string) {
  setGenerationStatus(username, true).then(() => {
    generateAndSaveAsync(username).catch((err) => {
      console.error("[Recommend] Background generation error:", err);
      if (err.message === "User cancelled generation") {
        setGenerationStatus(username, false);
      } else {
        setGenerationError(username, err.message || "Failed to generate recommendations.");
      }
    });
  });
}

async function generateAndSaveAsync(username: string) {
  console.log(`[Recommend] Starting generation for user: ${username}`);
  const t0 = Date.now();

  const ratings = await getRatings(username);
  const watchlist = await getWatchlist(username);
  console.log(`[Recommend] Fetched ${Object.keys(ratings).length} ratings and ${watchlist.length} watchlist items`);

  const aiSettings = await getAiSettings(username);
  const raw = await generateRecommendations(username, ratings, watchlist, aiSettings);
  const enriched = await enrichWithTmdb(raw);
  await saveRecommendations(username, enriched);

  const totalMs = Date.now() - t0;
  console.log(`[Recommend] Complete in ${totalMs}ms. ${enriched.recommendedMovies.length} movies, ${enriched.recommendedTvShows.length} TV shows`);
}

function extractUsername(req: NextRequest): string | null {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

function isStale(recs: any): boolean {
  if (!recs.generatedAt) return true;
  const twoHours = 2 * 60 * 60 * 1000;
  return Date.now() - recs.generatedAt > twoHours;
}
