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
    let retries = 3;
    let attempt = 0;

    while (attempt < retries) {
        attempt++;
        try {
            response = await fetch(url, { signal: controller.signal });
            if (response.status === 429) {
                console.warn(`[TMDB] 429 Rate limit hit for ${path}. Retrying in ${attempt * 1000}ms...`);
                await new Promise(r => setTimeout(r, attempt * 1000));
                continue;
            }
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`TMDB error ${response.status}: ${text}`);
            }
            break; // Success
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            if (attempt === retries) throw e;
            console.warn(`[TMDB] Network error for ${path}: ${e.message}. Retrying in ${attempt * 1000}ms...`);
            await new Promise(r => setTimeout(r, attempt * 1000));
        } finally {
            if (attempt === retries || (response && response.ok)) {
                clearTimeout(timeoutId);
            }
        }
    }

    const data = await response.json();
    if (!noCache) await setCached(tmdbCacheDir, url, data, tmdbCacheTtlMs);
    return data;
}

async function searchMovies(query, page = 1) {
    const params = { query, page };
    return tmdbGet("/search/movie", params, true);
}

async function searchTv(query, page = 1) {
    const params = { query, page };
    return tmdbGet("/search/tv", params, true);
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

export { searchMovies, searchTv, movieDetails, tvDetails, getTrendingMovies, getTrendingTv };
