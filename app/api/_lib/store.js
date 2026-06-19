import fs from "fs";
import path from "path";
import { defaultAiModel } from "./config.js";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".cache");
const DATA_FILE = path.join(DATA_DIR, "user-data.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function persist() {
  const store = globalThis.__app_store;
  if (!store) return;
  if (store._saveTimeout) clearTimeout(store._saveTimeout);
  store._saveTimeout = setTimeout(async () => {
    try {
      await fs.promises.writeFile(
        DATA_FILE,
        JSON.stringify({
          watchlist: [...store.watchlist],
          progress: [...store.progress],
          history: store.history,
          ratings: [...store.ratings],
          settings: store.settings,
          recommendations: store.recommendations,
        })
      );
    } catch (e) {
      console.error("[Store] Failed to persist:", e.message, "DATA_DIR:", DATA_DIR);
    }
  }, 500);
}

function persistSync() {
  const store = globalThis.__app_store;
  if (!store) return;
  if (store._saveTimeout) {
    clearTimeout(store._saveTimeout);
    store._saveTimeout = null;
  }
  try {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({
        watchlist: [...store.watchlist],
        progress: [...store.progress],
        history: store.history,
        ratings: [...store.ratings],
        settings: store.settings,
        recommendations: store.recommendations,
      })
    );
  } catch (e) {
    console.error("[Store] Failed to persist on exit:", e.message, "DATA_DIR:", DATA_DIR);
  }
}

// Bootstrap: runs only once across all Webpack layers
if (!globalThis.__app_store) {
  globalThis.__app_store = {
    watchlist: new Map(),
    progress: new Map(),
    history: [],
    ratings: new Map(),
    settings: {
      enabledSources: [],
      defaultSource: "videasy",
      aiApiKey: "",
      aiModel: defaultAiModel,
    },
    recommendations: {
      recommendedMovies: [],
      recommendedTvShows: [],
      madeForYou: { movies: [], tv: [] },
      newToYou: { movies: [], tv: [] },
      isGenerating: false,
      error: null,
      generatedAt: null,
    },
    _saveTimeout: null,
  };

  function load() {
    try {
      if (!fs.existsSync(DATA_FILE)) return;
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      const s = globalThis.__app_store;
      s.watchlist = new Map(data.watchlist || []);
      s.progress = new Map(data.progress || []);
      s.history = data.history || [];
      s.ratings = new Map(data.ratings || []);
      if (data.settings) Object.assign(s.settings, data.settings);
      if (data.recommendations) Object.assign(s.recommendations, data.recommendations);
    } catch (e) {
      console.error("[Store] Failed to load:", e.message, "DATA_DIR:", DATA_DIR);
    }
  }

  function seedIfEmpty() {
    const s = globalThis.__app_store;
    if (s.ratings.size > 0) return;
    const seedFile = path.join(process.cwd(), "data", "seed.json");
    if (!fs.existsSync(seedFile)) return;
    try {
      const seed = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
      s.ratings = new Map(seed.ratings || []);
      s.watchlist = new Map(seed.watchlist || []);
      persistSync();
      console.log(`[Store] Seeded ${s.ratings.size} ratings + ${s.watchlist.size} watchlist from data/seed.json`);
    } catch (e) {
      console.error("[Store] Failed to seed:", e.message, "DATA_DIR:", DATA_DIR);
    }
  }

  load();
  seedIfEmpty();

  process.on("exit", persistSync);
  process.on("SIGTERM", () => { persistSync(); });
  process.on("SIGINT", () => { persistSync(); process.exit(0); });
}

export async function getWatchlist() {
  const s = globalThis.__app_store;
  return [...s.watchlist.values()]
    .map(r => ({
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      movieDetails: r.movieDetails,
      addedAt: r.addedAt,
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function addToWatchlist(tmdbId, movieDetails, mediaType) {
  const s = globalThis.__app_store;
  s.watchlist.set(tmdbId, { tmdbId, mediaType, movieDetails, addedAt: Date.now() });
  persist();
}

export async function removeFromWatchlist(tmdbId) {
  const s = globalThis.__app_store;
  s.watchlist.delete(tmdbId);
  persist();
}

export async function getProgress() {
  const s = globalThis.__app_store;
  const items = [...s.progress.values()].map(r => ({
    tmdbId: r.tmdbId,
    timestamp: r.timestamp,
    duration: r.duration,
    movieDetails: r.movieDetails,
    mediaType: r.mediaType,
    source: r.source,
    updatedAt: r.updatedAt,
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

export async function saveProgress(tmdbId, timestamp, duration, movieDetails, mediaType, source) {
  const s = globalThis.__app_store;
  if (!duration || duration <= 0) return;
  const percentage = timestamp / duration;
  if (percentage > 0.95) {
    s.progress.delete(tmdbId);
    await addToHistory(tmdbId, movieDetails);
  } else {
    s.progress.set(tmdbId, {
      tmdbId, timestamp, duration, movieDetails, mediaType, source: source || null, updatedAt: Date.now(),
    });
    persist();
  }
}

export async function getHistory() {
  const s = globalThis.__app_store;
  return s.history
    .map(r => ({ tmdbId: r.tmdbId, movieDetails: r.movieDetails, watchedAt: r.watchedAt }))
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, 50);
}

export async function addToHistory(tmdbId, movieDetails) {
  const s = globalThis.__app_store;
  s.history = s.history.filter(h => h.tmdbId !== tmdbId);
  s.history.push({ tmdbId, movieDetails, watchedAt: Date.now() });
  s.history.sort((a, b) => b.watchedAt - a.watchedAt);
  if (s.history.length > 50) s.history = s.history.slice(0, 50);
  persist();
}

export async function removeFromHistory(tmdbId) {
  const s = globalThis.__app_store;
  s.history = s.history.filter(h => h.tmdbId !== tmdbId);
  persist();
}

export async function getRatings() {
  const ratings = {};
  for (const [tmdbId, r] of globalThis.__app_store.ratings) {
    ratings[tmdbId] = {
      rating: r.rating,
      movieDetails: r.movieDetails,
      ratedAt: r.ratedAt,
      thoughts: r.thoughts || "",
    };
  }
  return ratings;
}

export async function saveRating(tmdbId, rating, movieDetails, thoughts) {
  const s = globalThis.__app_store;
  s.ratings.set(tmdbId, { tmdbId, rating, movieDetails, ratedAt: Date.now(), thoughts: thoughts || "" });
  persist();
}

export async function deleteRating(tmdbId) {
  const s = globalThis.__app_store;
  s.ratings.delete(tmdbId);
  persist();
}

export async function getSourcePrefs() {
  const s = globalThis.__app_store;
  return {
    enabled: s.settings.enabledSources,
    defaultSource: s.settings.defaultSource || "videasy",
  };
}

export async function saveSourcePrefs(enabledSources, defaultSource) {
  const s = globalThis.__app_store;
  s.settings.enabledSources = enabledSources;
  s.settings.defaultSource = defaultSource;
  persist();
}

export async function getAiSettings() {
  const s = globalThis.__app_store;
  return {
    apiKey: s.settings.aiApiKey || "",
    model: s.settings.aiModel || defaultAiModel,
  };
}

export async function saveAiSettings(settings) {
  const s = globalThis.__app_store;
  s.settings.aiApiKey = settings.apiKey || "";
  s.settings.aiModel = settings.model || defaultAiModel;
  persist();
}

export async function getRecommendations() {
  const s = globalThis.__app_store;
  const r = s.recommendations;
  if (!r.generatedAt && !r.isGenerating && !r.error) return null;
  return {
    recommendedMovies: r.recommendedMovies || [],
    recommendedTvShows: r.recommendedTvShows || [],
    madeForYou: r.madeForYou || { movies: [], tv: [] },
    newToYou: r.newToYou || { movies: [], tv: [] },
    isGenerating: !!r.isGenerating,
    error: r.error,
    generatedAt: r.generatedAt,
  };
}

export async function setGenerationStatus(isGenerating) {
  const s = globalThis.__app_store;
  if (isGenerating) {
    s.recommendations.isGenerating = true;
    s.recommendations.error = null;
  } else {
    s.recommendations.isGenerating = false;
  }
  persist();
}

export async function setGenerationError(errorMsg) {
  const s = globalThis.__app_store;
  s.recommendations.isGenerating = false;
  s.recommendations.error = errorMsg;
  persist();
}

export async function saveRecommendations(recs) {
  const s = globalThis.__app_store;
  s.recommendations.recommendedMovies = recs.recommendedMovies || [];
  s.recommendations.recommendedTvShows = recs.recommendedTvShows || [];
  s.recommendations.madeForYou = recs.madeForYou || { movies: [], tv: [] };
  s.recommendations.newToYou = recs.newToYou || { movies: [], tv: [] };
  s.recommendations.isGenerating = false;
  s.recommendations.generatedAt = Date.now();
  persist();
}
