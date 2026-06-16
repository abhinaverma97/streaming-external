const EMPTY_IMAGE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function extractTrailerUrl(videos: any): string | null {
    const results = videos?.results;
    if (!results) return null;
    const trailer = results.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || results.find((v: any) => v.site === "YouTube");
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

export function getPosterUrl(path: string): string {
    return path ? `https://image.tmdb.org/t/p/w500${path}` : EMPTY_IMAGE;
}

export function getBackdropUrl(path: string): string {
    return path ? `https://image.tmdb.org/t/p/w1280${path}` : EMPTY_IMAGE;
}


