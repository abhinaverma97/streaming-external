import { Movie } from "./types";

export function extractTrailerUrl(videos: any): string | null {
    const results = videos?.results;
    if (!results) return null;
    const trailer = results.find((v: any) => v.site === "YouTube" && v.type === "Trailer") || results.find((v: any) => v.site === "YouTube");
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

export function getPosterUrl(path: string): string {
    return path ? `https://image.tmdb.org/t/p/w500${path}` : "https://via.placeholder.com/500x750?text=No+Poster";
}

export function getBackdropUrl(path: string): string {
    return path ? `https://image.tmdb.org/t/p/w1280${path}` : "";
}

export function getCardBackdropUrl(path: string): string {
    return path ? `https://image.tmdb.org/t/p/w500${path}` : "https://via.placeholder.com/500x281?text=No+Preview";
}

export function getMovieThemeColor(movie: Movie | null): [number, number, number] {
    if (!movie) return [0.15, 0.15, 0.18];

    let hash = 0;
    const titleText = movie.title || movie.name || "";
    for (let i = 0; i < titleText.length; i++) {
        hash = titleText.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    const s = 0.35;
    const v = 0.18;

    const c = v * s;
    const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;
    if (hue < 60) { r = c; g = x; }
    else if (hue < 120) { r = x; g = c; }
    else if (hue < 180) { g = c; b = x; }
    else if (hue < 240) { g = x; b = c; }
    else if (hue < 300) { r = x; b = c; }
    else { r = c; b = x; }

    return [r + m, g + m, b + m];
}
