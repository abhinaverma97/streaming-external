import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../_lib/auth.js";
import { getRatings, getRecommendations, saveRecommendations, getDb, setGenerationStatus, setGenerationError, getAiSettings } from "../_lib/user-db.js";
import { generateRecommendations, enrichWithTmdb } from "../_lib/recommend.js";

export async function GET(req: NextRequest) {
  try {
    const username = extractUsername(req);
    if (!username) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const db = await getDb(username);
    const cached = getRecommendationsFromDb(db);

    if (cached?.isGenerating) {
      return NextResponse.json(cached);
    }

    if (!cached || isStale(cached)) {
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
      setGenerationError(username, err.message || "Failed to generate recommendations.");
    });
  });
}

async function generateAndSaveAsync(username: string) {
  console.log(`[Recommend] Starting generation for user: ${username}`);
  const t0 = Date.now();

  const ratings = await getRatings(username);
  console.log(`[Recommend] Fetched ${Object.keys(ratings).length} ratings`);

  const aiSettings = await getAiSettings(username);
  const raw = await generateRecommendations(ratings, aiSettings);
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

function getRecommendationsFromDb(db: any) {
  return db.recommendations || null;
}

function isStale(recs: any): boolean {
  if (!recs.generatedAt) return true;
  const twelveHours = 12 * 60 * 60 * 1000;
  return Date.now() - recs.generatedAt > twelveHours;
}
