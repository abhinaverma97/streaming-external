export function getWatchlistId(movie: { media_type?: string; id: number }): string {
    return movie.media_type === "tv" ? `tv-${movie.id}` : String(movie.id);
}
