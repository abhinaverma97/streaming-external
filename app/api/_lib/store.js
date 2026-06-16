import fs from "fs";
import path from "path";
import { defaultAiModel } from "./config.js";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".cache");
const DATA_FILE = path.join(DATA_DIR, "user-data.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const store = {
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
    store.watchlist = new Map(data.watchlist || []);
    store.progress = new Map(data.progress || []);
    store.history = data.history || [];
    store.ratings = new Map(data.ratings || []);
    if (data.settings) Object.assign(store.settings, data.settings);
    if (data.recommendations) Object.assign(store.recommendations, data.recommendations);
  } catch (e) {
    console.error("[Store] Failed to load:", e.message, "DATA_DIR:", DATA_DIR);
  }
}

function persist() {
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

// Synchronous flush used on process exit so a pending debounced write is not lost.
function persistSync() {
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

load();

// Seed from data/seed.json on first boot (empty volume).
// Pure JSON read — no network calls, no async, ~0ms.
function seedIfEmpty() {
  if (store.ratings.size > 0) return; // already has data
  const seedFile = path.join(process.cwd(), "data", "seed.json");
  if (!fs.existsSync(seedFile)) return;
  try {
    const seed = JSON.parse(fs.readFileSync(seedFile, "utf-8"));
    store.ratings = new Map(seed.ratings || []);
    store.watchlist = new Map(seed.watchlist || []);
    persistSync(); // write to volume immediately so next boot skips this
    console.log(`[Store] Seeded ${store.ratings.size} ratings + ${store.watchlist.size} watchlist from data/seed.json`);
  } catch (e) {
    console.error("[Store] Failed to seed:", e.message, "DATA_DIR:", DATA_DIR);
  }
}

seedIfEmpty();

process.on("exit", persistSync);
process.on("SIGTERM", () => { persistSync(); process.exit(0); });
process.on("SIGINT", () => { persistSync(); process.exit(0); });

export async function getWatchlist() {
  return [...store.watchlist.values()]
    .map(r => ({
      tmdbId: r.tmdbId,
      mediaType: r.mediaType,
      movieDetails: r.movieDetails,
      addedAt: r.addedAt,
    }))
    .sort((a, b) => b.addedAt - a.addedAt);
}

export async function addToWatchlist(tmdbId, movieDetails, mediaType) {
  store.watchlist.set(tmdbId, { tmdbId, mediaType, movieDetails, addedAt: Date.now() });
  persist();
}

export async function removeFromWatchlist(tmdbId) {
  store.watchlist.delete(tmdbId);
  persist();
}

export async function getProgress() {
  const items = [...store.progress.values()].map(r => ({
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
  if (!duration || duration <= 0) return;
  const percentage = timestamp / duration;
  if (percentage > 0.95) {
    store.progress.delete(tmdbId);
    await addToHistory(tmdbId, movieDetails);
  } else {
    store.progress.set(tmdbId, {
      tmdbId, timestamp, duration, movieDetails, mediaType, source: source || null, updatedAt: Date.now(),
    });
    persist();
  }
}

export async function getHistory() {
  return store.history
    .map(r => ({ tmdbId: r.tmdbId, movieDetails: r.movieDetails, watchedAt: r.watchedAt }))
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, 50);
}

export async function addToHistory(tmdbId, movieDetails) {
  store.history = store.history.filter(h => h.tmdbId !== tmdbId);
  store.history.push({ tmdbId, movieDetails, watchedAt: Date.now() });
  store.history.sort((a, b) => b.watchedAt - a.watchedAt);
  if (store.history.length > 50) store.history = store.history.slice(0, 50);
  persist();
}

export async function removeFromHistory(tmdbId) {
  store.history = store.history.filter(h => h.tmdbId !== tmdbId);
  persist();
}

export async function getRatings() {
  const ratings = {};
  for (const [tmdbId, r] of store.ratings) {
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
  store.ratings.set(tmdbId, { tmdbId, rating, movieDetails, ratedAt: Date.now(), thoughts: thoughts || "" });
  persist();
}

export async function deleteRating(tmdbId) {
  store.ratings.delete(tmdbId);
  persist();
}

export async function getSourcePrefs() {
  return {
    enabled: store.settings.enabledSources,
    defaultSource: store.settings.defaultSource || "videasy",
  };
}

export async function saveSourcePrefs(enabledSources, defaultSource) {
  store.settings.enabledSources = enabledSources;
  store.settings.defaultSource = defaultSource;
  persist();
}

export async function getAiSettings() {
  return {
    apiKey: store.settings.aiApiKey || "",
    model: store.settings.aiModel || defaultAiModel,
  };
}

export async function saveAiSettings(settings) {
  store.settings.aiApiKey = settings.apiKey || "";
  store.settings.aiModel = settings.model || defaultAiModel;
  persist();
}

export async function getRecommendations() {
  const r = store.recommendations;
  if (!r.generatedAt && !r.isGenerating && !r.error) return null;
  return {
    recommendedMovies: r.recommendedMovies || [],
    recommendedTvShows: r.recommendedTvShows || [],
    isGenerating: !!r.isGenerating,
    error: r.error,
    generatedAt: r.generatedAt,
  };
}

export async function setGenerationStatus(isGenerating) {
  if (isGenerating) {
    store.recommendations.isGenerating = true;
    store.recommendations.error = null;
  } else {
    store.recommendations.isGenerating = false;
  }
  persist();
}

export async function setGenerationError(errorMsg) {
  store.recommendations.isGenerating = false;
  store.recommendations.error = errorMsg;
  persist();
}

export async function saveRecommendations(recs) {
  store.recommendations.recommendedMovies = recs.recommendedMovies || [];
  store.recommendations.recommendedTvShows = recs.recommendedTvShows || [];
  store.recommendations.isGenerating = false;
  store.recommendations.generatedAt = Date.now();
  persist();
}
