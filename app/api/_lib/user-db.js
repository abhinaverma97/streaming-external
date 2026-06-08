import fs from "fs/promises";
import path from "path";

const WRITE_DEBOUNCE_MS = 2000;

const dbs = new Map();
const writeTimers = new Map();

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function userDbPath(username) {
  return path.join(process.cwd(), ".cache", "users", username, "user-data.json");
}

export async function getDb(username) {
  if (!username) throw new Error("Username required");
  if (dbs.has(username)) return dbs.get(username);
  const dbPath = userDbPath(username);
  let data;
  try {
    const raw = await fs.readFile(dbPath, "utf-8");
    data = JSON.parse(raw);
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
  try {
    await ensureDir(path.dirname(dbPath));
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`[UserDB] Error writing ${dbPath}`, e);
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
  const handleSignal = () => {
    for (const username of dbs.keys()) {
      if (writeTimers.has(username)) { clearTimeout(writeTimers.get(username)); writeTimers.delete(username); }
      writeDb(username);
    }
  };
  process.on("SIGTERM", handleSignal);
  process.on("SIGINT", handleSignal);
}

// ── Watchlist ──────────────────────────────────────────────────────────

export async function getWatchlist(username) {
  const db = await getDb(username);
  return db.watchlist || [];
}

export async function addToWatchlist(username, tmdbId, movieDetails, mediaType) {
  const db = await getDb(username);
  if (!db.watchlist) db.watchlist = [];
  const exists = db.watchlist.some(item => item.tmdbId === tmdbId);
  if (!exists) {
    db.watchlist.push({ tmdbId, movieDetails, mediaType, addedAt: Date.now() });
    scheduleWrite(username);
    await flushDb(username);
  }
}

export async function removeFromWatchlist(username, tmdbId) {
  const db = await getDb(username);
  if (!db.watchlist) db.watchlist = [];
  db.watchlist = db.watchlist.filter(item => item.tmdbId !== tmdbId);
  scheduleWrite(username);
  await flushDb(username);
}

// ── Continue Watching / Progress ───────────────────────────────────────

export async function getProgress(username) {
  const db = await getDb(username);
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

export async function saveProgress(username, tmdbId, timestamp, duration, movieDetails, mediaType, source) {
  const db = await getDb(username);
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
  await flushDb(username);
}

// ── History ────────────────────────────────────────────────────────────

export async function getHistory(username) {
  const db = await getDb(username);
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

export async function addToHistory(username, tmdbId, movieDetails) {
  const db = await getDb(username);
  addToHistoryInternal(db, tmdbId, movieDetails);
  scheduleWrite(username);
  await flushDb(username);
}

export async function removeFromHistory(username, tmdbId) {
  const db = await getDb(username);
  if (!db.history) db.history = [];
  db.history = db.history.filter(item => item.tmdbId !== tmdbId);
  scheduleWrite(username);
  await flushDb(username);
}

// ── Ratings ────────────────────────────────────────────────────────────

export async function getRatings(username) {
  const db = await getDb(username);
  return db.ratings || {};
}

export async function saveRating(username, id, rating, movieDetails) {
  const db = await getDb(username);
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

export async function getSourcePrefs(username) {
  const db = await getDb(username);
  return db.sourcePrefs || { enabled: [], defaultSource: "videasy" };
}

export async function saveSourcePrefs(username, enabled, defaultSource) {
  const db = await getDb(username);
  db.sourcePrefs = { enabled, defaultSource };
  scheduleWrite(username);
  await flushDb(username);
}

// ── AI Settings ────────────────────────────────────────────────

export async function getAiSettings(username) {
  const db = await getDb(username);
  return db.aiSettings || { apiKey: "", model: "openai/gpt-oss-120b:free" };
}

export async function saveAiSettings(username, settings) {
  const db = await getDb(username);
  db.aiSettings = {
    apiKey: settings.apiKey || "",
    model: settings.model || "openai/gpt-oss-120b:free"
  };
  scheduleWrite(username);
  await flushDb(username);
}

// ── Recommendations ────────────────────────────────────────────

export async function getRecommendations(username) {
  const db = await getDb(username);
  return db.recommendations || null;
}

export async function getGenerationStatus(username) {
  const db = await getDb(username);
  return db.recommendations?.isGenerating || false;
}

export async function setGenerationStatus(username, isGenerating) {
  const db = await getDb(username);
  if (!db.recommendations) {
    db.recommendations = { recommendedMovies: [], recommendedTvShows: [] };
  }
  db.recommendations.isGenerating = isGenerating;
  if (isGenerating) {
    db.recommendations.startedAt = Date.now();
    delete db.recommendations.error;
  }
  scheduleWrite(username);
  await flushDb(username);
}

export async function setGenerationError(username, errorMsg) {
  const db = await getDb(username);
  if (!db.recommendations) {
    db.recommendations = { recommendedMovies: [], recommendedTvShows: [] };
  }
  db.recommendations.isGenerating = false;
  db.recommendations.error = errorMsg;
  scheduleWrite(username);
  await flushDb(username);
}

export async function saveRecommendations(username, recs) {
  const db = await getDb(username);
  db.recommendations = {
    generatedAt: Date.now(),
    recommendedMovies: recs.recommendedMovies || [],
    recommendedTvShows: recs.recommendedTvShows || [],
    isGenerating: false,
  };
  scheduleWrite(username);
  await flushDb(username);
}

export function isRecommendationsStale(db) {
  if (!db.recommendations || !db.recommendations.generatedAt) return true;
  const twelveHours = 12 * 60 * 60 * 1000;
  return Date.now() - db.recommendations.generatedAt > twelveHours;
}
