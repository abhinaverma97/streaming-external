import fs from "fs";
import path from "path";

const DB_FILE = path.join(process.cwd(), ".cache", "user-data.json");
const WRITE_DEBOUNCE_MS = 2000;

let currentDb = null;
let writeTimer = null;

function ensureDbDir() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDb() {
  if (currentDb) return currentDb;
  ensureDbDir();
  if (!fs.existsSync(DB_FILE)) {
    currentDb = { watchlist: [], progress: {}, history: [], ratings: {} };
    return currentDb;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    currentDb = JSON.parse(raw);
  } catch (e) {
    console.error("[UserDB] Error reading user-data.json, returning empty database", e);
    currentDb = { watchlist: [], progress: {}, history: [], ratings: {} };
  }
  return currentDb;
}

async function writeDb() {
  try {
    ensureDbDir();
    await fs.promises.writeFile(DB_FILE, JSON.stringify(currentDb, null, 2), "utf-8");
  } catch (e) {
    console.error("[UserDB] Error writing user-data.json", e);
  }
}

function scheduleWrite() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => { writeTimer = null; writeDb(); }, WRITE_DEBOUNCE_MS);
}

async function flushDb() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  await writeDb();
}

// ── Graceful shutdown ──────────────────────────────────────────────

if (typeof process !== "undefined") {
  const handleSignal = async () => {
    if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    if (currentDb) await writeDb();
  };
  process.on("SIGTERM", handleSignal);
  process.on("SIGINT", handleSignal);
}

// ── Watchlist ──────────────────────────────────────────────────────────

export function getWatchlist() {
  return getDb().watchlist || [];
}

export async function addToWatchlist(tmdbId, movieDetails, mediaType) {
  const db = getDb();
  if (!db.watchlist) db.watchlist = [];
  const exists = db.watchlist.some(item => item.tmdbId === tmdbId);
  if (!exists) {
    db.watchlist.push({ tmdbId, movieDetails, mediaType, addedAt: Date.now() });
    scheduleWrite();
    await flushDb();
  }
}

export async function removeFromWatchlist(tmdbId) {
  const db = getDb();
  if (!db.watchlist) db.watchlist = [];
  db.watchlist = db.watchlist.filter(item => item.tmdbId !== tmdbId);
  scheduleWrite();
  await flushDb();
}

// ── Continue Watching / Progress ───────────────────────────────────────

export function getProgress() {
  const db = getDb();
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
  const db = getDb();
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
  scheduleWrite();
}

// ── History ────────────────────────────────────────────────────────────

export function getHistory() {
  return getDb().history || [];
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

export async function addToHistory(tmdbId, movieDetails) {
  const db = getDb();
  addToHistoryInternal(db, tmdbId, movieDetails);
  scheduleWrite();
  await flushDb();
}

export async function removeFromHistory(tmdbId) {
  const db = getDb();
  if (!db.history) db.history = [];
  db.history = db.history.filter(item => item.tmdbId !== tmdbId);
  scheduleWrite();
  await flushDb();
}

// ── Ratings ────────────────────────────────────────────────────────────

export function getRatings() {
  return getDb().ratings || {};
}

export async function saveRating(id, rating, movieDetails) {
  const db = getDb();
  if (!db.ratings) db.ratings = {};
  db.ratings[id] = {
    rating,
    movieDetails,
    ratedAt: Date.now()
  };
  scheduleWrite();
  await flushDb();
}

// ── Source Preferences ──────────────────────────────────────────────

export function getSourcePrefs() {
  const db = getDb();
  return db.sourcePrefs || { enabled: [], defaultSource: "vidking" };
}

export async function saveSourcePrefs(enabled, defaultSource) {
  const db = getDb();
  db.sourcePrefs = { enabled, defaultSource };
  scheduleWrite();
  await flushDb();
}
