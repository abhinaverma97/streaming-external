function getDirector(details: any): string {
  if (details.director) return details.director;
  const crew = details.credits?.crew;
  if (crew) {
    const dir = crew.find((c: any) => c.job === "Director");
    if (dir) return dir.name;
  }
  return "Unknown";
}

export function formatRatedItems(ratings: Record<string, any>): string {
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
      return `${i + 1}. "${title}" (${year}) - ${mediaType}\n   User Rating: ${userRating}/5${thoughts}\n   TMDB Rating: ${tmdbRating}/10\n   Director: ${director}\n   Synopsis: ${synopsis}`;
    })
    .join("\n\n");
}

export function formatWatchlistItems(watchlist: any[]): string {
  if (!watchlist || watchlist.length === 0) return "None";
  return watchlist
    .map(w => `- "${w.movieDetails?.title || w.movieDetails?.name || "Unknown"}" (${(w.movieDetails?.release_date || w.movieDetails?.first_air_date || "").slice(0, 4) || "Unknown"}) - ${w.mediaType}`)
    .join("\n");
}
