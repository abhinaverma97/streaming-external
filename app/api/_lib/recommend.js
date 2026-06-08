import { searchMovies, searchTv } from "./tmdb.js";

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
      return `${i + 1}. "${title}" (${year}) - ${mediaType}
   User Rating: ${userRating}/5
   TMDB Rating: ${tmdbRating}/10
   Director: ${director}
   Synopsis: ${synopsis}`;
    })
    .join("\n\n");
}

function buildPrompt(formatted) {
  return `You are a movie and TV show recommendation engine.

Analyze this user's complete set of rated content as a whole. Identify patterns in
genres, themes, directors, tone, and era preferences. Then recommend movies and TV
shows the user would likely enjoy.

USER'S RATED CONTENT (all items):

${formatted}

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
- Recommend ${RECOMMENDATION_COUNT}-15 items in each array
- Only recommend titles the user has NOT already rated
- Be specific — explain why each recommendation fits their taste`;
}

export function buildRecommendationPrompt(ratings) {
  const formatted = formatRatedItems(ratings);
  return buildPrompt(formatted);
}

export async function generateRecommendations(ratings) {
  const apiKey = API_KEY();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const prompt = buildRecommendationPrompt(ratings);

  console.log(`[Recommend] Building prompt with ${Object.keys(ratings).length} rated items`);
  console.log(`[Recommend] Prompt length: ${prompt.length} chars`);

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.log(`[Recommend] OpenRouter fetch timed out after 1 hour`);
    controller.abort();
  }, 3600000);

  const t0 = Date.now();
  console.log(`[Recommend] Calling OpenRouter...`);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    signal: controller.signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b:free",
      messages: [{ role: "user", content: prompt }],
      reasoning: { enabled: true },
      temperature: 0.7,
    }),
  });
  clearTimeout(timeout);

  console.log(`[Recommend] OpenRouter responded in ${Date.now() - t0}ms with status ${res.status}`);

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
      const data = await searchMovies(item.title);
      const result = findBestMatch(data.results || [], item.title, item.year);
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
      const data = await searchTv(item.title);
      const result = findBestMatch(data.results || [], item.title, item.year);
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
