function getDirector(details: any): string {
  if (details.director) return details.director;
  const crew = details.credits?.crew;
  if (crew) {
    const dir = crew.find((c: any) => c.job === "Director");
    if (dir) return dir.name;
  }
  return "Unknown";
}

function getGenres(details: any): string {
  if (details.genres && Array.isArray(details.genres)) {
    return details.genres.map((g: any) => g.name).join(", ");
  }
  return "Unknown";
}

function formatRatedItems(ratings: Record<string, any>): string {
  const entries = Object.entries(ratings).filter(([, v]) => v?.movieDetails);
  return entries
    .map(([tmdbId, item], i) => {
      const d = item.movieDetails;
      const title = d.title || d.name || "Unknown";
      const year = (d.release_date || d.first_air_date || "").slice(0, 4) || "Unknown";
      const mediaType = d.media_type === "tv" ? "TV Show" : "Movie";
      const userRating = item.rating ?? "?";
      const tmdbRating = d.vote_average ?? "N/A";
      const director = getDirector(d);
      const genres = getGenres(d);
      const thoughts = item.thoughts ? `\n   User Thoughts: ${item.thoughts}` : "";
      return `${i + 1}. "${title}" (${year}) - ${mediaType}\n   User Rating: ${userRating}/5${thoughts}\n   TMDB: ${tmdbRating}/10\n   Director: ${director}\n   Genres: ${genres}`;
    })
    .join("\n\n");
}

function formatWatchlistItems(watchlist: any[]): string {
  if (!watchlist || watchlist.length === 0) return "None";
  return watchlist
    .map(w => `- "${w.movieDetails?.title || w.movieDetails?.name || "Unknown"}" (${(w.movieDetails?.release_date || w.movieDetails?.first_air_date || "").slice(0, 4) || "Unknown"}) - ${w.mediaType}`)
    .join("\n");
}

function computeTasteProfile(ratings: Record<string, any>): string {
  const entries = Object.entries(ratings).filter(([, v]) => v?.movieDetails);
  if (entries.length === 0) return "No ratings yet.";

  const movies = entries.filter(([, v]) => v.movieDetails.media_type !== "tv");
  const tv = entries.filter(([, v]) => v.movieDetails.media_type === "tv");

  const genreMap: Record<string, { count: number; totalRating: number }> = {};
  const directorMap: Record<string, number> = {};
  const decadeMap: Record<string, number> = {};
  const ratingDist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalRating = 0;

  for (const [, v] of entries) {
    const d = v.movieDetails;
    const r = v.rating ?? 0;
    totalRating += r;
    if (r >= 1 && r <= 5) ratingDist[r as keyof typeof ratingDist]++;

    if (d.genres) {
      for (const g of d.genres) {
        if (!genreMap[g.name]) genreMap[g.name] = { count: 0, totalRating: 0 };
        genreMap[g.name].count++;
        genreMap[g.name].totalRating += r;
      }
    }

    const dir = getDirector(d);
    if (dir !== "Unknown") directorMap[dir] = (directorMap[dir] || 0) + 1;

    const yearStr = (d.release_date || d.first_air_date || "").slice(0, 4);
    if (yearStr) {
      const y = parseInt(yearStr);
      if (!isNaN(y)) {
        const decade = Math.floor(y / 10) * 10;
        decadeMap[`${decade}s`] = (decadeMap[`${decade}s`] || 0) + 1;
      }
    }
  }

  const avg = (totalRating / entries.length).toFixed(1);
  const sortedGenres = Object.entries(genreMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, d]) => `${name}: ${d.count} (avg ${(d.totalRating / d.count).toFixed(1)}/5)`);

  const sortedDirectors = Object.entries(directorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, c]) => `${name} (${c})`);

  const sortedDecades = Object.entries(decadeMap)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([d, c]) => `${d}: ${c}`);

  return [
    `Total rated: ${entries.length} (${movies.length} movies, ${tv.length} TV)`,
    `Average rating: ${avg}/5`,
    `Rating distribution: 5\u2605=${ratingDist[5]} 4\u2605=${ratingDist[4]} 3\u2605=${ratingDist[3]} 2\u2605=${ratingDist[2]} 1\u2605=${ratingDist[1]}`,
    ``,
    `Genres (by volume):`,
    ...sortedGenres.map(l => `  ${l}`),
    ``,
    `Decades:`,
    ...sortedDecades.map(l => `  ${l}`),
    ``,
    `Top directors:`,
    ...sortedDirectors.map(l => `  ${l}`),
  ].join("\n");
}

function computeBlockedTitles(ratings: Record<string, any>): string {
  const entries = Object.entries(ratings).filter(([, v]) => v?.movieDetails);
  return entries
    .map(([, v]) => {
      const d = v.movieDetails;
      const title = d.title || d.name || "Unknown";
      const year = (d.release_date || d.first_air_date || "").slice(0, 4) || "Unknown";
      return `- "${title}" (${year})`;
    })
    .join("\n");
}

function buildPrompt(tasteProfile: string, formatted: string, formattedWatchlist: string, blockedTitles: string): string {
  return `You are a movie and TV show recommendation engine. Your task is to recommend titles the user has NEVER watched or rated before. This is critical — every recommendation must be absent from the BLOCKED TITLES section below.

USER'S TASTE PROFILE:
${tasteProfile}

USER'S RATED CONTENT:
${formatted || "None"}

USER'S WATCHLIST:
${formattedWatchlist || "None"}

CRITICAL RULES:
1. NEVER recommend anything listed in BLOCKED TITLES below. If uncertain whether the user has seen a title, skip it.
2. Analyze the taste profile and rated content for patterns in genres, directors, themes, eras, and tone.
3. Generate the following categories with NO duplicates across any of them:

   A. "madeForYou" — exactly 4 movies and 4 TV shows that closely match the user's established taste. Safe bets.
   B. "newToYou" — exactly 4 movies and 4 TV shows outside the user's comfort zone (different genres, eras, directors) they'd still enjoy.
   C. "recommendedMovies" — at least 18 more movies (exclusive from A and B).
   D. "recommendedTvShows" — at least 18 more TV shows (exclusive from A and B).

   A title must NEVER appear in more than one category.

BLOCKED TITLES (already watched or rated — do NOT recommend):
${blockedTitles || "None"}

Return ONLY raw JSON. No markdown, no codeblocks, no introduction:

{
  "madeForYou": {
    "movies": [{ "title": "...", "year": 2024, "reason": "..." }],
    "tv": [{ "title": "...", "year": 2023, "reason": "..." }]
  },
  "newToYou": {
    "movies": [{ "title": "...", "year": 2024, "reason": "..." }],
    "tv": [{ "title": "...", "year": 2023, "reason": "..." }]
  },
  "recommendedMovies": [{ "title": "...", "year": 2024, "reason": "..." }],
  "recommendedTvShows": [{ "title": "...", "year": 2023, "reason": "..." }]
}`;
}

export function buildRecommendationPrompt(ratings: Record<string, any>, watchlist: any[]): string {
  const tasteProfile = computeTasteProfile(ratings);
  const formatted = formatRatedItems(ratings);
  const formattedWatchlist = formatWatchlistItems(watchlist);
  const blockedTitles = computeBlockedTitles(ratings);
  return buildPrompt(tasteProfile, formatted, formattedWatchlist, blockedTitles);
}
