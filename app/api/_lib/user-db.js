import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), ".cache", "user-data.json");

function ensureDbDir() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadDb() {
    ensureDbDir();
    if (!fs.existsSync(DB_FILE)) {
        return { watchlist: [], progress: {}, history: [], ratings: {} };
    }
    try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        return JSON.parse(raw);
    } catch (e) {
        console.error("[UserDB] Error reading user-data.json, returning empty database", e);
        return { watchlist: [], progress: {}, history: [], ratings: {} };
    }
}

function saveDb(data) {
    ensureDbDir();
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("[UserDB] Error saving user-data.json", e);
    }
}

// ── Watchlist ──────────────────────────────────────────────────────────

export function getWatchlist() {
    const db = loadDb();
    return db.watchlist || [];
}

export function addToWatchlist(tmdbId, movieDetails, mediaType) {
    const db = loadDb();
    if (!db.watchlist) db.watchlist = [];
    const exists = db.watchlist.some(item => item.tmdbId === tmdbId);
    if (!exists) {
        db.watchlist.push({ tmdbId, movieDetails, mediaType, addedAt: Date.now() });
        saveDb(db);
    }
}

export function removeFromWatchlist(tmdbId) {
    const db = loadDb();
    if (!db.watchlist) db.watchlist = [];
    db.watchlist = db.watchlist.filter(item => item.tmdbId !== tmdbId);
    saveDb(db);
}

// ── Continue Watching / Progress ───────────────────────────────────────

export function getProgress() {
    const db = loadDb();
    const items = Object.entries(db.progress || {}).map(([tmdbId, entry]) => ({
        tmdbId,
        ...entry
    }));

    const showGroups = new Map();
    const standalone = [];

    for (const item of items) {
        const isTv = item.mediaType === "tv" || item.tmdbId.startsWith("tv-");
        if (isTv) {
            const showId = item.movieDetails?.id;
            if (showId) {
                const existing = showGroups.get(showId);
                if (!existing || item.updatedAt > existing.updatedAt) {
                    showGroups.set(showId, item);
                }
            } else {
                standalone.push(item);
            }
        } else {
            standalone.push(item);
        }
    }

    return [...standalone, ...showGroups.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProgress(tmdbId, timestamp, duration, movieDetails, mediaType, source) {
    const db = loadDb();
    if (!db.progress) db.progress = {};
    if (!db.history) db.history = [];

    const percentage = timestamp / duration;

    if (percentage > 0.95) {
        delete db.progress[tmdbId];
        addToHistoryInternal(db, tmdbId, movieDetails);
    } else {
        db.progress[tmdbId] = {
            timestamp,
            duration,
            movieDetails,
            mediaType,
            source: source || undefined,
            updatedAt: Date.now()
        };
    }
    saveDb(db);
}

// ── History ────────────────────────────────────────────────────────────

export function getHistory() {
    const db = loadDb();
    return db.history || [];
}

function addToHistoryInternal(db, tmdbId, movieDetails) {
    if (!db.history) db.history = [];
    db.history = db.history.filter(item => item.tmdbId !== tmdbId);
    db.history.unshift({
        tmdbId,
        movieDetails,
        watchedAt: Date.now()
    });
    if (db.history.length > 50) {
        db.history.pop();
    }
}

export function addToHistory(tmdbId, movieDetails) {
    const db = loadDb();
    addToHistoryInternal(db, tmdbId, movieDetails);
    saveDb(db);
}

export function removeFromHistory(tmdbId) {
    const db = loadDb();
    if (!db.history) db.history = [];
    db.history = db.history.filter(item => item.tmdbId !== tmdbId);
    saveDb(db);
}

// ── Ratings ────────────────────────────────────────────────────────────

export function getRatings() {
    const db = loadDb();
    return db.ratings || {};
}

export function saveRating(id, rating, movieDetails) {
    const db = loadDb();
    if (!db.ratings) db.ratings = {};
    db.ratings[id] = {
        rating,
        movieDetails,
        ratedAt: Date.now()
    };
    saveDb(db);
}

// ── Source Preferences ──────────────────────────────────────────────

export function getSourcePrefs() {
    const db = loadDb();
    return db.sourcePrefs || { enabled: [], defaultSource: "vidking" };
}

export function saveSourcePrefs(enabled, defaultSource) {
    const db = loadDb();
    db.sourcePrefs = { enabled, defaultSource };
    saveDb(db);
}
