import { searchMulti } from "./tmdb.js";
import { buildRecommendationPrompt } from "../../lib/format-ratings";

let activeController = null;

export function cancelGeneration() {
  if (activeController) {
    activeController.abort(new Error("User cancelled generation"));
    activeController = null;
    return true;
  }
  return false;
}

export async function generateRecommendations(ratings, watchlist, aiSettings) {
  if (activeController) {
    console.log("[Recommend] Generation already in progress, skipping.");
    return null;
  }

  const apiKey = aiSettings?.apiKey;
  if (!apiKey) {
    throw new Error("API Key required. Please enter your OpenRouter API key in Settings.");
  }
  const model = aiSettings?.model || "openai/gpt-oss-120b:free";

  const prompt = buildRecommendationPrompt(ratings, watchlist);

  console.log(`[Recommend] Building prompt with ${Object.keys(ratings).length} rated items`);
  console.log(`[Recommend] Prompt length: ${prompt.length} chars`);

  const controller = new AbortController();
  activeController = controller;

  let timeout;
  try {
    timeout = setTimeout(() => {
      if (activeController !== controller) return;
      console.log(`[Recommend] OpenRouter fetch timed out after 1 hour`);
      controller.abort(new Error("Timeout"));
    }, 3600000);

    const t0 = Date.now();
    console.log(`[Recommend] Calling OpenRouter with model ${model}...`);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      signal: controller.signal,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        reasoning: { enabled: true },
        temperature: 0.7,
      }),
    });

    if (!res) {
      console.log(`[Recommend] OpenRouter fetch failed — no response (likely aborted)`);
      throw new Error("OpenRouter fetch failed");
    }

    console.log(`[Recommend] OpenRouter responded in ${Date.now() - t0}ms with status ${res.status}`);

    if (res.status === 429) {
      throw new Error("Rate Limit Reached. Please try again later or check your OpenRouter account.");
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[Recommend] OpenRouter error (${res.status}): ${body}`);
      throw new Error(`OpenRouter API error (${res.status}): ${body}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenRouter");
    console.log(`[Recommend] Response content length: ${content.length} chars`);

    let parsed;
    const tryParse = (s) => { try { return JSON.parse(s) } catch { return null } };

    parsed = tryParse(content);
    if (!parsed) {
      const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      parsed = tryParse(cleaned);
    }
    if (!parsed) {
      const match = content.match(/\{[\s\S]*\}/) || content.match(/\[[\s\S]*\]/);
      if (match) parsed = tryParse(match[0]);
    }
    if (!parsed) {
      throw new Error("Could not parse OpenRouter response as JSON:\n" + content);
    }

    if (Array.isArray(parsed)) {
      console.log("[Recommend] LLM returned an array, restructuring to object.");
      const movies = parsed.filter(i => !i.type || i.type === "movie" || i.isMovie);
      const shows = parsed.filter(i => i.type === "tv" || i.isTv);
      parsed = { recommendedMovies: movies, recommendedTvShows: shows };
    }

    const movieCount = (parsed.recommendedMovies || []).length;
    const tvCount = (parsed.recommendedTvShows || []).length;
    console.log(`[Recommend] Parsed ${movieCount} movies, ${tvCount} TV shows`);

    return {
      recommendedMovies: parsed.recommendedMovies || [],
      recommendedTvShows: parsed.recommendedTvShows || [],
    };
  } finally {
    activeController = null;
    clearTimeout(timeout);
  }
}

async function enrichItem(item, requestedMediaType) {
  try {
    const searchTitle = item.title.replace(/\(\d{4}\)/g, "").trim();
    let data = await searchMulti(searchTitle);
    let results = (data.results || []).filter(r => r.media_type === "movie" || r.media_type === "tv");
    
    let result = findBestMatch(results, item.year, requestedMediaType);

    if (result) {
      const isTv = result.media_type === "tv";
      return {
        ...item,
        id: result.id,
        title: isTv ? result.name : result.title,
        poster_path: result.poster_path,
        backdrop_path: result.backdrop_path,
        overview: result.overview,
        vote_average: result.vote_average,
        ...(isTv ? { first_air_date: result.first_air_date } : { release_date: result.release_date }),
        media_type: result.media_type,
      };
    }
    return { ...item, id: null, media_type: requestedMediaType };
  } catch (err) {
    console.error(`[Recommend] Failed to enrich "${item.title}": ${err}`);
    return { ...item, id: null, media_type: requestedMediaType };
  }
}

const CONCURRENCY = 5;

async function enrichBatch(items, mediaType) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(item => enrichItem(item, mediaType))
    );
    batchResults.forEach((r, idx) => {
      results.push(r.status === "fulfilled" ? r.value : { ...batch[idx], id: null, media_type: mediaType });
    });
  }
  return results;
}

export async function enrichWithTmdb(recommendations) {
  const t0 = Date.now();
  console.log(`[Recommend] Enriching ${recommendations.recommendedMovies.length} movies and ${recommendations.recommendedTvShows.length} TV shows with TMDB data (concurrency ${CONCURRENCY})`);

  const [enrichedMovies, enrichedTvShows] = await Promise.all([
    enrichBatch(recommendations.recommendedMovies || [], "movie"),
    enrichBatch(recommendations.recommendedTvShows || [], "tv"),
  ]);

  console.log(`[Recommend] Enrichment complete in ${Date.now() - t0}ms. Final: ${enrichedMovies.length} movies, ${enrichedTvShows.length} TV shows`);

  return { recommendedMovies: enrichedMovies, recommendedTvShows: enrichedTvShows };
}

function findBestMatch(results, year, preferredMediaType) {
  if (!results || results.length === 0) return null;

  if (year && year !== "Unknown") {
    const targetYear = parseInt(String(year), 10);
    
    let match = results.find((r) => {
      if (r.media_type !== preferredMediaType) return false;
      const date = r.release_date || r.first_air_date || "";
      const rYear = parseInt(date.substring(0, 4), 10);
      return !isNaN(rYear) && Math.abs(rYear - targetYear) <= 1;
    });
    if (match) return match;
    
    match = results.find((r) => {
      const date = r.release_date || r.first_air_date || "";
      const rYear = parseInt(date.substring(0, 4), 10);
      return !isNaN(rYear) && Math.abs(rYear - targetYear) <= 1;
    });
    if (match) return match;
  }

  const typeMatch = results.find(r => r.media_type === preferredMediaType);
  if (typeMatch) return typeMatch;

  return results[0];
}

export async function runFullGenerationPipeline() {
  const { setGenerationStatus, setGenerationError, getRatings, getWatchlist, getAiSettings, saveRecommendations } = await import("./store.js");

  await setGenerationStatus(true);
  try {
    const ratings = await getRatings();
    const watchlist = await getWatchlist();
    const aiSettings = await getAiSettings();

    const raw = await generateRecommendations(ratings, watchlist, aiSettings);
    if (!raw) return; // already in progress — exit without recording an error
    const enriched = await enrichWithTmdb(raw);
    await saveRecommendations(enriched);
  } catch (err) {
    console.error("[Recommend] Error generating:", err);
    if (err.message === "User cancelled generation") {
      await setGenerationStatus(false);
    } else {
      await setGenerationError(err.message || "Failed to generate recommendations.");
    }
    throw err;
  }
}
