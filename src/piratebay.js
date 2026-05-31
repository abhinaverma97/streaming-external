import fetch from 'node-fetch';
import { trackers } from "./config.js";

function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export async function searchPirateBay(query) {
    if (!query) return [];
    
    const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        },
        timeout: 8000
    });
    if (!res.ok) throw new Error(`PirateBay API error: ${res.status}`);
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const LIMIT_7GB = 7 * 1024 * 1024 * 1024;
    
    return data
        .filter(item => {
            if (item.id === "0" && item.name === "No results returned") return false;
            const size = parseInt(item.size, 10);
            return size <= LIMIT_7GB;
        })
        .map(item => ({
            quality: item.name, // maps to frontend's quality property
            hash: item.info_hash,
            size: formatBytes(parseInt(item.size, 10) || 0),
            seeds: parseInt(item.seeders, 10) || 0,
            peers: parseInt(item.leechers, 10) || 0
        }))
        .sort((a, b) => b.seeds - a.seeds)
        .slice(0, 10);
}

export async function findMovieByImdb(imdbId, titleFallback = "", year = "") {
    let torrents = [];
    if (imdbId) {
        try {
            torrents = await searchPirateBay(imdbId);
        } catch (e) {
            console.error(`[PirateBay] Search by IMDb ID failed for ${imdbId}: ${e.message}`);
        }
    }
    if ((!torrents || torrents.length === 0) && titleFallback) {
        try {
            // Remove special characters or keep simple search string for better matches
            const sanitizedTitle = titleFallback.replace(/[^a-zA-Z0-9\s]/g, "");
            const query = year ? `${sanitizedTitle} ${year}` : sanitizedTitle;
            torrents = await searchPirateBay(query);
        } catch (e) {
            console.error(`[PirateBay] Search by title failed for ${titleFallback}: ${e.message}`);
        }
    }
    return {
        title: titleFallback || imdbId,
        torrents: torrents || []
    };
}

export async function findEpisodeTorrents(showName, season, episode) {
    const sStr = String(season).padStart(2, "0");
    const eStr = String(episode).padStart(2, "0");
    const query = `${showName} S${sStr}E${eStr}`;
    console.log(`[PirateBay] Searching for TV episode with query: "${query}"`);
    let torrents = [];
    try {
        torrents = await searchPirateBay(query);
    } catch (e) {
        console.error(`[PirateBay] Episode search failed for ${query}: ${e.message}`);
    }
    return {
        title: query,
        torrents: torrents || []
    };
}

export function buildMagnet({ hash, name }) {
    const encodedName = encodeURIComponent(name || "movie");
    const trackersQuery = trackers.map((tracker) => `tr=${encodeURIComponent(tracker)}`).join("&");
    return `magnet:?xt=urn:btih:${hash}&dn=${encodedName}&${trackersQuery}`;
}
