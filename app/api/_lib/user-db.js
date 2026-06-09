import db from "./db";

// ── Watchlist ──────────────────────────────────────────────────────────

export async function getWatchlist(username) {
  const rows = db.prepare("SELECT * FROM watchlist WHERE username = ? ORDER BY addedAt DESC").all(username);
  return rows.map(r => ({
    tmdbId: r.tmdbId,
    mediaType: r.mediaType,
    movieDetails: JSON.parse(r.movieDetails),
    addedAt: r.addedAt
  }));
}

export async function addToWatchlist(username, tmdbId, movieDetails, mediaType) {
  db.prepare("INSERT OR REPLACE INTO watchlist (username, tmdbId, mediaType, movieDetails, addedAt) VALUES (?, ?, ?, ?, ?)")
    .run(username, tmdbId, mediaType, JSON.stringify(movieDetails), Date.now());
}

export async function removeFromWatchlist(username, tmdbId) {
  db.prepare("DELETE FROM watchlist WHERE username = ? AND tmdbId = ?").run(username, tmdbId);
}

// ── Continue Watching / Progress ───────────────────────────────────────

export async function getProgress(username) {
  const rows = db.prepare("SELECT * FROM progress WHERE username = ?").all(username);
  const items = rows.map(r => ({
    tmdbId: r.tmdbId,
    timestamp: r.timestamp,
    duration: r.duration,
    movieDetails: JSON.parse(r.movieDetails),
    mediaType: r.mediaType,
    source: r.source,
    updatedAt: r.updatedAt
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
  const percentage = timestamp / duration;
  if (percentage > 0.95) {
    db.prepare("DELETE FROM progress WHERE username = ? AND tmdbId = ?").run(username, tmdbId);
    await addToHistory(username, tmdbId, movieDetails);
  } else {
    db.prepare("INSERT OR REPLACE INTO progress (username, tmdbId, timestamp, duration, movieDetails, mediaType, source, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(username, tmdbId, timestamp, duration, JSON.stringify(movieDetails), mediaType, source || null, Date.now());
  }
}

// ── History ────────────────────────────────────────────────────────────

export async function getHistory(username) {
  const rows = db.prepare("SELECT * FROM history WHERE username = ? ORDER BY watchedAt DESC LIMIT 50").all(username);
  return rows.map(r => ({
    tmdbId: r.tmdbId,
    movieDetails: JSON.parse(r.movieDetails),
    watchedAt: r.watchedAt
  }));
}

export async function addToHistory(username, tmdbId, movieDetails) {
  db.prepare("DELETE FROM history WHERE username = ? AND tmdbId = ?").run(username, tmdbId);
  db.prepare("INSERT INTO history (username, tmdbId, movieDetails, watchedAt) VALUES (?, ?, ?, ?)")
    .run(username, tmdbId, JSON.stringify(movieDetails), Date.now());
  
  // Cleanup to keep max 50
  const rows = db.prepare("SELECT id FROM history WHERE username = ? ORDER BY watchedAt DESC").all(username);
  if (rows.length > 50) {
    const toDelete = rows.slice(50).map(r => r.id);
    const placeholders = toDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM history WHERE id IN (${placeholders})`).run(...toDelete);
  }
}

export async function removeFromHistory(username, tmdbId) {
  db.prepare("DELETE FROM history WHERE username = ? AND tmdbId = ?").run(username, tmdbId);
}

// ── Ratings ────────────────────────────────────────────────────────────

export async function getRatings(username) {
  const rows = db.prepare("SELECT * FROM ratings WHERE username = ?").all(username);
  const ratings = {};
  for (const r of rows) {
    ratings[r.tmdbId] = {
      rating: r.rating,
      movieDetails: JSON.parse(r.movieDetails),
      ratedAt: r.ratedAt,
      thoughts: r.thoughts || ""
    };
  }
  return ratings;
}

export async function saveRating(username, tmdbId, rating, movieDetails, thoughts) {
  db.prepare("INSERT OR REPLACE INTO ratings (username, tmdbId, rating, movieDetails, ratedAt, thoughts) VALUES (?, ?, ?, ?, ?, ?)")
    .run(username, tmdbId, rating, JSON.stringify(movieDetails), Date.now(), thoughts || "");
}

export async function deleteRating(username, tmdbId) {
  db.prepare("DELETE FROM ratings WHERE username = ? AND tmdbId = ?").run(username, tmdbId);
}

// ── Settings (Source & AI) ──────────────────────────────────────────────

function ensureSettingsRow(username) {
  db.prepare("INSERT OR IGNORE INTO settings (username) VALUES (?)").run(username);
}

export async function getSourcePrefs(username) {
  const row = db.prepare("SELECT enabledSources, defaultSource FROM settings WHERE username = ?").get(username);
  if (!row || !row.enabledSources) return { enabled: [], defaultSource: "videasy" };
  return {
    enabled: JSON.parse(row.enabledSources),
    defaultSource: row.defaultSource || "videasy"
  };
}

export async function saveSourcePrefs(username, enabled, defaultSource) {
  ensureSettingsRow(username);
  db.prepare("UPDATE settings SET enabledSources = ?, defaultSource = ? WHERE username = ?")
    .run(JSON.stringify(enabled), defaultSource, username);
}

export async function getAiSettings(username) {
  const row = db.prepare("SELECT aiApiKey, aiModel FROM settings WHERE username = ?").get(username);
  if (!row) return { apiKey: "", model: "openai/gpt-oss-120b:free" };
  return {
    apiKey: row.aiApiKey || "",
    model: row.aiModel || "openai/gpt-oss-120b:free"
  };
}

export async function saveAiSettings(username, settings) {
  ensureSettingsRow(username);
  db.prepare("UPDATE settings SET aiApiKey = ?, aiModel = ? WHERE username = ?")
    .run(settings.apiKey || "", settings.model || "openai/gpt-oss-120b:free", username);
}

// ── Recommendations ────────────────────────────────────────────

function ensureRecRow(username) {
  db.prepare("INSERT OR IGNORE INTO recommendations (username) VALUES (?)").run(username);
}

export async function getRecommendations(username) {
  const r = db.prepare("SELECT * FROM recommendations WHERE username = ?").get(username);
  if (!r) return null;
  return {
    recommendedMovies: r.recommendedMovies ? JSON.parse(r.recommendedMovies) : [],
    recommendedTvShows: r.recommendedTvShows ? JSON.parse(r.recommendedTvShows) : [],
    isGenerating: !!r.isGenerating,
    error: r.error,
    generatedAt: r.generatedAt
  };
}

export async function getGenerationStatus(username) {
  const r = db.prepare("SELECT isGenerating FROM recommendations WHERE username = ?").get(username);
  return r ? !!r.isGenerating : false;
}

export async function setGenerationStatus(username, isGenerating) {
  ensureRecRow(username);
  if (isGenerating) {
    db.prepare("UPDATE recommendations SET isGenerating = 1, error = NULL WHERE username = ?").run(username);
  } else {
    db.prepare("UPDATE recommendations SET isGenerating = 0 WHERE username = ?").run(username);
  }
}

export async function setGenerationError(username, errorMsg) {
  ensureRecRow(username);
  db.prepare("UPDATE recommendations SET isGenerating = 0, error = ? WHERE username = ?").run(errorMsg, username);
}

export async function saveRecommendations(username, recs) {
  ensureRecRow(username);
  db.prepare("UPDATE recommendations SET recommendedMovies = ?, recommendedTvShows = ?, isGenerating = 0, generatedAt = ? WHERE username = ?")
    .run(JSON.stringify(recs.recommendedMovies || []), JSON.stringify(recs.recommendedTvShows || []), Date.now(), username);
}

export async function getDb(username) {
  // Dummy export for backward compatibility where needed
  return {};
}
