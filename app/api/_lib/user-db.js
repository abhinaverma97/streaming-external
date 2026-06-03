import fs from "fs";
import path from "path";

const WRITE_DEBOUNCE_MS = 2000;

const dbs = new Map();
const writeTimers = new Map();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function userDbPath(username) {
  return path.join(process.cwd(), ".cache", "users", username, "user-data.json");
}

function getDb(username) {
  if (!username) throw new Error("Username required");
  if (dbs.has(username)) return dbs.get(username);
  const dbPath = userDbPath(username);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
  } catch {
    data = { watchlist: [], progress: {}, history: [], ratings: {} };
  }
  dbs.set(username, data);
  return data;
}

async function writeDb(username) {
  const data = dbs.get(username);
  if (!data) return;
  const dbPath = userDbPath(username);
  ensureDir(path.dirname(dbPath));
  try {
    await fs.promises.writeFile(dbPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[UserDB] Error writing ${username}/user-data.json`, e);
  }
}

function scheduleWrite(username) {
  if (writeTimers.has(username)) clearTimeout(writeTimers.get(username));
  writeTimers.set(username, setTimeout(() => {
    writeTimers.delete(username);
    writeDb(username);
  }, WRITE_DEBOUNCE_MS));
}

async function flushDb(username) {
  if (writeTimers.has(username)) { clearTimeout(writeTimers.get(username)); writeTimers.delete(username); }
  await writeDb(username);
}

// ── Graceful shutdown ──────────────────────────────────────────────

if (typeof process !== "undefined") {
  const handleSignal = async () => {
    for (const username of dbs.keys()) {
      if (writeTimers.has(username)) { clearTimeout(writeTimers.get(username)); writeTimers.delete(username); }
      await writeDb(username);
    }
  };
  process.on("SIGTERM", handleSignal);
  process.on("SIGINT", handleSignal);
}

// ── Watchlist ──────────────────────────────────────────────────────────

export function getWatchlist(username) {
  return getDb(username).watchlist || [];
}

export async function addToWatchlist(username, tmdbId, movieDetails, mediaType) {
  const db = getDb(username);
  if (!db.watchlist) db.watchlist = [];
  const exists = db.watchlist.some(item => item.tmdbId === tmdbId);
  if (!exists) {
    db.watchlist.push({ tmdbId, movieDetails, mediaType, addedAt: Date.now() });
    scheduleWrite(username);
    await flushDb(username);
  }
}

export async function removeFromWatchlist(username, tmdbId) {
  const db = getDb(username);
  if (!db.watchlist) db.watchlist = [];
  db.watchlist = db.watchlist.filter(item => item.tmdbId !== tmdbId);
  scheduleWrite(username);
  await flushDb(username);
}

// ── Continue Watching / Progress ───────────────────────────────────────

export function getProgress(username) {
  const db = getDb(username);
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

export function saveProgress(username, tmdbId, timestamp, duration, movieDetails, mediaType, source) {
  const db = getDb(username);
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
  scheduleWrite(username);
}

// ── History ────────────────────────────────────────────────────────────

export function getHistory(username) {
  return getDb(username).history || [];
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

export async function addToHistory(username, tmdbId, movieDetails) {
  const db = getDb(username);
  addToHistoryInternal(db, tmdbId, movieDetails);
  scheduleWrite(username);
  await flushDb(username);
}

export async function removeFromHistory(username, tmdbId) {
  const db = getDb(username);
  if (!db.history) db.history = [];
  db.history = db.history.filter(item => item.tmdbId !== tmdbId);
  scheduleWrite(username);
  await flushDb(username);
}

// ── Ratings ────────────────────────────────────────────────────────────

export function getRatings(username) {
  return getDb(username).ratings || {};
}

export async function saveRating(username, id, rating, movieDetails) {
  const db = getDb(username);
  if (!db.ratings) db.ratings = {};
  db.ratings[id] = {
    rating,
    movieDetails,
    ratedAt: Date.now()
  };
  scheduleWrite(username);
  await flushDb(username);
}

// ── Source Preferences ──────────────────────────────────────────────

export function getSourcePrefs(username) {
  const db = getDb(username);
  return db.sourcePrefs || { enabled: [], defaultSource: "vidking" };
}

export async function saveSourcePrefs(username, enabled, defaultSource) {
  const db = getDb(username);
  db.sourcePrefs = { enabled, defaultSource };
  scheduleWrite(username);
  await flushDb(username);
}
