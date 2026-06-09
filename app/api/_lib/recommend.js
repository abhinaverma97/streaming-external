import { searchMovies, searchTv } from "./tmdb.js";

if (!global.activeGenerations) {
  global.activeGenerations = new Map();
}
const activeGenerations = global.activeGenerations;

export function cancelGeneration(username) {
  const controller = activeGenerations.get(username);
  if (controller) {
    controller.abort(new Error("User cancelled generation"));
    activeGenerations.delete(username);
    return true;
  }
  return false;
}

const API_KEY = () => process.env.OPENROUTER_API_KEY;

const RECOMMENDATION_COUNT = 15;

function getDirector(details) {
  if (details.director) return details.director;
  const crew = details.credits?.crew;
  if (crew) {
    const dir = crew.find((c) => c.job === "Director");
    if (dir) return dir.name;
  }
  return "Unknown";
}

function formatRatedItems(ratings) {
  const entries = Object.entries(ratings).filter(([, v]) => v?.movieDetails);
  return entries
    .map(([tmdbId, item], i) => {
      const d = item.movieDetails;
      const title = d.title || d.name || "Unknown";
      const year = (d.release_date || d.first_air_date || "").slice(0, 4) || "Unknown";
      const mediaType = tmdbId.startsWith("tv-") ? "TV Show" : "Movie";
      const userRating = item.rating ?? "?";
      const tmdbRating = d.vote_average ?? "N/A";
      const director = getDirector(d);
      const synopsis = d.overview || "N/A";
      const thoughts = item.thoughts ? `\n   User Thoughts: ${item.thoughts}` : "";
      return `${i + 1}. "${title}" (${year}) - ${mediaType}
   User Rating: ${userRating}/5${thoughts}
   TMDB Rating: ${tmdbRating}/10
   Director: ${director}
   Synopsis: ${synopsis}`;
    })
    .join("\n\n");
}

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
  const formattedWatchlist = (watchlist || []).map(w => `- "${w.movieDetails?.title || w.movieDetails?.name || "Unknown"}" (${(w.movieDetails?.release_date || w.movieDetails?.first_air_date || "").slice(0, 4) || "Unknown"}) - ${w.mediaType}`).join("\n");
  return buildPrompt(formatted, formattedWatchlist);
}

export async function generateRecommendations(username, ratings, watchlist, aiSettings) {
  const apiKey = aiSettings?.apiKey;
  if (!apiKey) {
    throw new Error("API Key required. Please enter your OpenRouter API key in Settings.");
  }
  const model = aiSettings?.model || "openai/gpt-oss-120b:free";

  const prompt = buildRecommendationPrompt(ratings, watchlist);

  console.log(`[Recommend] Building prompt with ${Object.keys(ratings).length} rated items`);
  console.log(`[Recommend] Prompt length: ${prompt.length} chars`);

  const controller = new AbortController();
  activeGenerations.set(username, controller);

  const timeout = setTimeout(() => {
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
    activeGenerations.delete(username);
    clearTimeout(timeout);
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

  const movieCount = (parsed.recommendedMovies || []).length;
  const tvCount = (parsed.recommendedTvShows || []).length;
  console.log(`[Recommend] Parsed ${movieCount} movies, ${tvCount} TV shows`);

  return {
    recommendedMovies: parsed.recommendedMovies || [],
    recommendedTvShows: parsed.recommendedTvShows || [],
  };
}
export async function enrichWithTmdb(recommendations) {
  const t0 = Date.now();
  console.log(`[Recommend] Enriching ${recommendations.recommendedMovies.length} movies and ${recommendations.recommendedTvShows.length} TV shows with TMDB data`);

  const enriched = { recommendedMovies: [], recommendedTvShows: [] };

  for (const item of recommendations.recommendedMovies || []) {
    try {
      const searchTitle = item.title.replace(/\(\d{4}\)/g, "").trim();
      let data = await searchMovies(searchTitle);
      let result = findBestMatch(data.results || [], searchTitle, item.year);
      
      // Fallback search without exact year match filter
      if (!result && data.results?.length > 0) {
          result = data.results[0];
      }
      
      if (result) {
        enriched.recommendedMovies.push({
          ...item,
          id: result.id,
          title: result.title,
          poster_path: result.poster_path,
          backdrop_path: result.backdrop_path,
          overview: result.overview,
          vote_average: result.vote_average,
          release_date: result.release_date,
          media_type: "movie",
        });
      } else {
        enriched.recommendedMovies.push({ ...item, id: null, media_type: "movie" });
      }
    } catch {
      enriched.recommendedMovies.push({ ...item, id: null, media_type: "movie" });
    }
  }

  for (const item of recommendations.recommendedTvShows || []) {
    try {
      const searchTitle = item.title.replace(/\(\d{4}\)/g, "").trim();
      let data = await searchTv(searchTitle);
      let result = findBestMatch(data.results || [], searchTitle, item.year);

      // Fallback search
      if (!result && data.results?.length > 0) {
          result = data.results[0];
      }

      if (result) {
        enriched.recommendedTvShows.push({
          ...item,
          id: result.id,
          title: result.name,
          poster_path: result.poster_path,
          backdrop_path: result.backdrop_path,
          overview: result.overview,
          vote_average: result.vote_average,
          first_air_date: result.first_air_date,
          media_type: "tv",
        });
      } else {
        enriched.recommendedTvShows.push({ ...item, id: null, media_type: "tv" });
      }
    } catch {
      enriched.recommendedTvShows.push({ ...item, id: null, media_type: "tv" });
    }
  }

  console.log(`[Recommend] Enrichment complete in ${Date.now() - t0}ms. Final: ${enriched.recommendedMovies.length} movies, ${enriched.recommendedTvShows.length} TV shows`);

  return enriched;
}

function findBestMatch(results, title, year) {
  if (!results || results.length === 0) return null;

  if (year && year !== "Unknown") {
    const yearStr = String(year);
    const exact = results.find((r) => {
      const date = r.release_date || r.first_air_date || "";
      return date.startsWith(yearStr);
    });
    if (exact) return exact;
  }

  return results[0];
}
