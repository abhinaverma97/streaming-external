import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "sources.json");

let cachedSources = null;

function loadSources() {
    if (cachedSources) return cachedSources;
    try {
        if (!fs.existsSync(configPath)) {
            cachedSources = { movies: {}, tv: {} };
            return cachedSources;
        }
        const raw = fs.readFileSync(configPath, "utf-8");
        cachedSources = JSON.parse(raw);
        return cachedSources;
    } catch (e) {
        console.error("[Sources] Error reading sources.json:", e.message);
        cachedSources = { movies: {}, tv: {} };
        return cachedSources;
    }
}

export function getSourceUrl(tmdbId, mediaType = "movie", season, episode) {
    const sources = loadSources();
    const category = mediaType === "tv" ? sources.tv : sources.movies;
    const entry = category ? category[String(tmdbId)] : null;
    if (!entry) return null;

    let url = null;
    if (entry.urlTemplate && season !== undefined && episode !== undefined) {
        url = entry.urlTemplate
            .replace("{tmdbId}", tmdbId)
            .replace("{season}", season)
            .replace("{episode}", episode);
    } else if (entry.url) {
        url = entry.url
            .replace("{tmdbId}", tmdbId)
            .replace("{season}", season ?? "")
            .replace("{episode}", episode ?? "");
    }

    return url;
}
