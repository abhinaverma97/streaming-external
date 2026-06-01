import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, "..", ".cache", "user-data.json");

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

export function addToWatchlist(imdbId, movieDetails, mediaType) {
    const db = loadDb();
    if (!db.watchlist) db.watchlist = [];
    const exists = db.watchlist.some(item => item.imdbId === imdbId);
    if (!exists) {
        db.watchlist.push({ imdbId, movieDetails, mediaType, addedAt: Date.now() });
        saveDb(db);
    }
}

export function removeFromWatchlist(imdbId) {
    const db = loadDb();
    if (!db.watchlist) db.watchlist = [];
    db.watchlist = db.watchlist.filter(item => item.imdbId !== imdbId);
    saveDb(db);
}

// ── Continue Watching / Progress ───────────────────────────────────────

export function getProgress() {
    const db = loadDb();
    const items = Object.entries(db.progress || {}).map(([imdbId, entry]) => ({
        imdbId,
        ...entry
    }));
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveProgress(imdbId, timestamp, duration, movieDetails, mediaType) {
    const db = loadDb();
    if (!db.progress) db.progress = {};
    if (!db.history) db.history = [];

    const percentage = timestamp / duration;

    if (percentage > 0.95) {
        delete db.progress[imdbId];
        addToHistoryInternal(db, imdbId, movieDetails);
    } else {
        db.progress[imdbId] = {
            timestamp,
            duration,
            movieDetails,
            mediaType,
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

function addToHistoryInternal(db, imdbId, movieDetails) {
    if (!db.history) db.history = [];
    db.history = db.history.filter(item => item.imdbId !== imdbId);
    db.history.unshift({
        imdbId,
        movieDetails,
        watchedAt: Date.now()
    });
    if (db.history.length > 50) {
        db.history.pop();
    }
}

export function addToHistory(imdbId, movieDetails) {
    const db = loadDb();
    addToHistoryInternal(db, imdbId, movieDetails);
    saveDb(db);
}

export function removeFromHistory(imdbId) {
    const db = loadDb();
    if (!db.history) db.history = [];
    db.history = db.history.filter(item => item.imdbId !== imdbId);
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

