import { searchMovies, searchTv } from "./tmdb.js";
import { buildRecommendationPrompt } from "../../lib/format-ratings";

let activeController = null;
let activeUserId = null;

export function cancelGeneration() {
  if (activeController) {
    activeController.abort(new Error("User cancelled generation"));
    activeController = null;
    activeUserId = null;
    return true;
  }
  return false;
}

export function getActiveUserId() {
  return activeUserId;
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

    // Strip <think>...</think> blocks which are common in reasoning models
    const strippedContent = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    parsed = tryParse(strippedContent);
    if (!parsed) {
      const cleaned = strippedContent.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      parsed = tryParse(cleaned);
    }
    if (!parsed) {
      const match = strippedContent.match(/\{[\s\S]*\}/) || strippedContent.match(/\[[\s\S]*\]/);
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
    const mfyMovieCount = (parsed.madeForYou?.movies || []).length;
    const mfyTvCount = (parsed.madeForYou?.tv || []).length;
    const ntyMovieCount = (parsed.newToYou?.movies || []).length;
    const ntyTvCount = (parsed.newToYou?.tv || []).length;
    console.log(`[Recommend] Parsed ${movieCount} movies, ${tvCount} TV shows, ${mfyMovieCount}/${mfyTvCount} madeForYou, ${ntyMovieCount}/${ntyTvCount} newToYou`);

    return {
      recommendedMovies: parsed.recommendedMovies || [],
      recommendedTvShows: parsed.recommendedTvShows || [],
      madeForYou: parsed.madeForYou || { movies: [], tv: [] },
      newToYou: parsed.newToYou || { movies: [], tv: [] },
    };
  } finally {
    activeController = null;
    if (!activeUserId) clearTimeout(timeout);
    else clearTimeout(timeout);
  }
}

async function enrichItem(item, searchFn, mediaType) {
  try {
    const searchTitle = item.title.replace(/\(\d{4}\)/g, "").trim();
    let data = await searchFn(searchTitle);
    
    let result = data.results?.[0];

    if (result) {
      const isTv = mediaType === "tv";
      return {
        ...item,
        id: result.id,
        title: isTv ? result.name : result.title,
        poster_path: result.poster_path,
        backdrop_path: result.backdrop_path,
        overview: result.overview,
        vote_average: result.vote_average,
        ...(isTv ? { first_air_date: result.first_air_date } : { release_date: result.release_date }),
        media_type: mediaType,
      };
    }
    return { ...item, id: null, media_type: mediaType };
  } catch (err) {
    console.error(`[Recommend] Failed to enrich "${item.title}": ${err}`);
    return { ...item, id: null, media_type: mediaType };
  }
}

const CONCURRENCY = 5;

async function enrichBatch(items, searchFn, mediaType) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map(item => enrichItem(item, searchFn, mediaType))
    );
    batchResults.forEach((r, idx) => {
      results.push(r.status === "fulfilled" ? r.value : { ...batch[idx], id: null, media_type: mediaType });
    });
  }
  return results;
}

export async function enrichWithTmdb(recommendations) {
  const t0 = Date.now();
  const total = (recommendations.recommendedMovies?.length || 0) + (recommendations.recommendedTvShows?.length || 0)
    + (recommendations.madeForYou?.movies?.length || 0) + (recommendations.madeForYou?.tv?.length || 0)
    + (recommendations.newToYou?.movies?.length || 0) + (recommendations.newToYou?.tv?.length || 0);
  console.log(`[Recommend] Enriching ${total} items with TMDB data (concurrency ${CONCURRENCY})`);

  const [enrichedMovies, enrichedTvShows, mfyMovies, mfyTv, ntyMovies, ntyTv] = await Promise.all([
    enrichBatch(recommendations.recommendedMovies || [], searchMovies, "movie"),
    enrichBatch(recommendations.recommendedTvShows || [], searchTv, "tv"),
    enrichBatch(recommendations.madeForYou?.movies || [], searchMovies, "movie"),
    enrichBatch(recommendations.madeForYou?.tv || [], searchTv, "tv"),
    enrichBatch(recommendations.newToYou?.movies || [], searchMovies, "movie"),
    enrichBatch(recommendations.newToYou?.tv || [], searchTv, "tv"),
  ]);

  console.log(`[Recommend] Enrichment complete in ${Date.now() - t0}ms`);

  return {
    recommendedMovies: enrichedMovies,
    recommendedTvShows: enrichedTvShows,
    madeForYou: { movies: mfyMovies, tv: mfyTv },
    newToYou: { movies: ntyMovies, tv: ntyTv },
  };
}

export async function runFullGenerationPipeline(userId) {
  const { setGenerationStatus, setGenerationError, getRatings, getWatchlist, getAiSettings, saveRecommendations } = await import("./store.js");

  await setGenerationStatus(userId, true);
  activeUserId = userId;
  try {
    const ratings = await getRatings(userId);
    const watchlist = await getWatchlist(userId);
    const aiSettings = await getAiSettings(userId);

    const raw = await generateRecommendations(ratings, watchlist, aiSettings);
    if (!raw) return;
    const enriched = await enrichWithTmdb(raw);
    await saveRecommendations(userId, enriched);
  } catch (err) {
    console.error("[Recommend] Error generating:", err);
    if (err.message === "User cancelled generation") {
      await setGenerationStatus(userId, false);
    } else {
      await setGenerationError(userId, err.message || "Failed to generate recommendations.");
    }
    throw err;
  } finally {
    activeUserId = null;
  }
}
