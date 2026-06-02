import fs from "fs";
import path from "path";

const configPath = path.join(process.cwd(), "sources.json");

function loadSources() {
    try {
        if (!fs.existsSync(configPath)) return { movies: {}, tv: {} };
        const raw = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(raw);
    } catch (e) {
        console.error("[Sources] Error reading sources.json:", e.message);
        return { movies: {}, tv: {} };
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
