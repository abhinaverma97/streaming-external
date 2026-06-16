function getDirector(details: any): string {
  if (details.director) return details.director;
  const crew = details.credits?.crew;
  if (crew) {
    const dir = crew.find((c: any) => c.job === "Director");
    if (dir) return dir.name;
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
      const synopsis = d.overview || "N/A";
      const thoughts = item.thoughts ? `\n   User Thoughts: ${item.thoughts}` : "";
      return `${i + 1}. "${title}" (${year}) - ${mediaType}\n   User Rating: ${userRating}/5${thoughts}\n   TMDB Rating: ${tmdbRating}/10\n   Director: ${director}\n   Synopsis: ${synopsis}`;
    })
    .join("\n\n");
}

function formatWatchlistItems(watchlist: any[]): string {
  if (!watchlist || watchlist.length === 0) return "None";
  return watchlist
    .map(w => `- "${w.movieDetails?.title || w.movieDetails?.name || "Unknown"}" (${(w.movieDetails?.release_date || w.movieDetails?.first_air_date || "").slice(0, 4) || "Unknown"}) - ${w.mediaType}`)
    .join("\n");
}

function buildPrompt(formatted: string, formattedWatchlist: string): string {
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

export function buildRecommendationPrompt(ratings: Record<string, any>, watchlist: any[]): string {
  const formatted = formatRatedItems(ratings);
  const formattedWatchlist = formatWatchlistItems(watchlist);
  return buildPrompt(formatted, formattedWatchlist);
}
