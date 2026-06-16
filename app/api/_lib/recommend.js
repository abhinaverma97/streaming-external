import { searchMovies, searchTv } from "./tmdb.js";

let activeController = null;

export function cancelGeneration() {
  if (activeController) {
    activeController.abort(new Error("User cancelled generation"));
    activeController = null;
    return true;
  }
  return false;
}

import { formatRatedItems, formatWatchlistItems } from "../../lib/format-ratings";

function buildPrompt(formatted, formattedWatchlist) {
  return `You are a movie and TV show recommendation engine.

Analyze this user's complete set of rated content as a whole. Identify patterns in
genres, themes, directors, tone, and era preferences. Then recommend movies and TV
shows the user would likely enjoy.

USER'S RATED CONTENT:
${formatted || "None"}

USER'S WATCHLIST:
${formattedWatchlist || "None"}

Based on ALL items above, return a JSON object with:

{
  "recommendedMovies": [
    { "title": "Inception", "year": 2010, "reason": "You enjoy Christopher Nolan's complex storytelling" }
  ],
  "recommendedTvShows": [
    { "title": "Better Call Saul", "year": 2015, "reason": "You enjoy Vince Gilligan's character-driven crime dramas" }
  ]
}

IMPORTANT:
- The "year" field must be the release year of the recommended title (used to look it up on TMDB)
- Recommend AT LEAST 18 movies and 18 TV shows.
- DO NOT recommend anything already in the user's rated content list OR their watchlist above.
- Provide a brief 1-sentence reason for each recommendation based on their ratings.
- ONLY output the raw JSON object. No markdown, no introduction, no codeblocks.`;
}

export function buildRecommendationPrompt(ratings, watchlist) {
  const formatted = formatRatedItems(ratings);
  const formattedWatchlist = formatWatchlistItems(watchlist);
  return buildPrompt(formatted, formattedWatchlist);
}

export async function generateRecommendations(ratings, watchlist, aiSettings) {
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

  const timeout = setTimeout(() => {
    if (activeController !== controller) return;
    console.log(`[Recommend] OpenRouter fetch timed out after 1 hour`);
    controller.abort(new Error("Timeout"));
  }, 3600000);

  const t0 = Date.now();
  console.log(`[Recommend] Calling OpenRouter with model ${model}...`);

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
  } finally {
    activeController = null;
    clearTimeout(timeout);
  }

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

  // Fallback if LLM returned an Array instead of an Object
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
}
async function enrichItem(item, searchFn, mediaType) {
  try {
    const searchTitle = item.title.replace(/\(\d{4}\)/g, "").trim();
    let data = await searchFn(searchTitle, item.year);
    let result = findBestMatch(data.results || [], searchTitle, item.year);

    // Fallback: If no results when searching with year, try without year
    if (!result || data.results?.length === 0) {
      console.log(`[Recommend] No matches for "${searchTitle}" with year ${item.year}, falling back to title-only search...`);
      data = await searchFn(searchTitle);
      result = findBestMatch(data.results || [], searchTitle, null);
    }

    if (!result && data.results?.length > 0) {
      result = data.results[0];
    }

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
    console.error(`[Recommend] Failed to enrich ${mediaType} "${item.title}": ${err}`);
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
    for (const r of batchResults) {
      results.push(r.status === "fulfilled" ? r.value : { ...batch[results.length - batch.length + batchResults.indexOf(r)], id: null, media_type: mediaType });
    }
  }
  return results;
}

export async function enrichWithTmdb(recommendations) {
  const t0 = Date.now();
  console.log(`[Recommend] Enriching ${recommendations.recommendedMovies.length} movies and ${recommendations.recommendedTvShows.length} TV shows with TMDB data (concurrency ${CONCURRENCY})`);

  const [enrichedMovies, enrichedTvShows] = await Promise.all([
    enrichBatch(recommendations.recommendedMovies || [], searchMovies, "movie"),
    enrichBatch(recommendations.recommendedTvShows || [], searchTv, "tv"),
  ]);

  console.log(`[Recommend] Enrichment complete in ${Date.now() - t0}ms. Final: ${enrichedMovies.length} movies, ${enrichedTvShows.length} TV shows`);

  return { recommendedMovies: enrichedMovies, recommendedTvShows: enrichedTvShows };
}

function findBestMatch(results, title, year) {
  if (!results || results.length === 0) return null;

  if (year && year !== "Unknown") {
    const targetYear = parseInt(String(year), 10);
    const exact = results.find((r) => {
      const date = r.release_date || r.first_air_date || "";
      const rYear = parseInt(date.substring(0, 4), 10);
      if (isNaN(rYear)) return false;
      return Math.abs(rYear - targetYear) <= 1; // Fuzzy match: +/- 1 year
    });
    if (exact) return exact;
  }

  return results[0];
}
