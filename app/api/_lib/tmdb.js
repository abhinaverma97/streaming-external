import { getCached, setCached } from "./cache.js";
import { tmdbApiKey, tmdbCacheDir, tmdbCacheTtlMs } from "./config.js";

const TMDB_BASE = "https://api.themoviedb.org/3";

function buildUrl(path, params = {}) {
    const url = new URL(`${TMDB_BASE}${path}`);
    url.searchParams.set("api_key", tmdbApiKey);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
}

async function tmdbGet(path, params, noCache = false) {
    const url = buildUrl(path, params);
    if (!noCache) {
        const cached = await getCached(tmdbCacheDir, url, tmdbCacheTtlMs);
        if (cached) return cached;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error("TMDB timeout after 10s")), 10000);
    let response;
    try {
        response = await fetch(url, { signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`TMDB error ${response.status}: ${text}`);
    }

    const data = await response.json();
    if (!noCache) await setCached(tmdbCacheDir, url, data, tmdbCacheTtlMs);
    return data;
}

async function searchMovies(query, page) {
    return tmdbGet("/search/movie", { query, page });
}

async function searchTv(query, page) {
    return tmdbGet("/search/tv", { query, page });
}

async function searchMulti(query, page) {
    return tmdbGet("/search/multi", { query, page }, false);
}

async function movieDetails(tmdbId) {
    return tmdbGet(`/movie/${tmdbId}`, { append_to_response: "credits,external_ids,videos" });
}

async function tvDetails(tmdbId) {
    return tmdbGet(`/tv/${tmdbId}`, { append_to_response: "credits,external_ids,videos" });
}

async function getTrendingMovies(page = 1) {
    return tmdbGet("/trending/movie/week", { page });
}

async function getTrendingTv(page = 1) {
    return tmdbGet("/trending/tv/week", { page });
}

async function getTopRatedMovies(page = 1) {
    return tmdbGet("/movie/top_rated", { page });
}

async function getMoviesByGenre(genreId, page = 1) {
    return tmdbGet("/discover/movie", { with_genres: genreId, page, sort_by: "popularity.desc" });
}

async function getTvByGenre(genreId, page = 1) {
    return tmdbGet("/discover/tv", { with_genres: genreId, page, sort_by: "popularity.desc" });
}

export { searchMovies, searchTv, searchMulti, movieDetails, tvDetails, getTrendingMovies, getTrendingTv, getTopRatedMovies, getMoviesByGenre, getTvByGenre };
