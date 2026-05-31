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

async function tmdbGet(path, params) {
    const url = buildUrl(path, params);
    const cached = getCached(tmdbCacheDir, url, tmdbCacheTtlMs);
    if (cached) return cached;

    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`TMDB error ${response.status}: ${text}`);
    }

    const data = await response.json();
    setCached(tmdbCacheDir, url, data, tmdbCacheTtlMs);
    return data;
}

async function searchMovies(query, page) {
    return tmdbGet("/search/movie", { query, page });
}

async function searchTv(query, page) {
    return tmdbGet("/search/tv", { query, page });
}

async function searchMulti(query, page) {
    return tmdbGet("/search/multi", { query, page });
}

async function movieDetails(tmdbId) {
    return tmdbGet(`/movie/${tmdbId}`, { append_to_response: "credits,external_ids" });
}

async function tvDetails(tmdbId) {
    return tmdbGet(`/tv/${tmdbId}`, { append_to_response: "credits,external_ids" });
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

export { searchMovies, searchTv, searchMulti, movieDetails, tvDetails, getTrendingMovies, getTrendingTv, getTopRatedMovies, getMoviesByGenre };
