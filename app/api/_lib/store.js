import db from './db.js';
import { defaultAiModel } from './config.js';
import { migrateIfNeeded, migrateTimestampsIfNeeded, migrateRatingsTo10Scale } from './migrate.js';

const MS_THRESHOLD = 1000000000000;

// Run migrations on first import
migrateIfNeeded();
migrateTimestampsIfNeeded();
migrateRatingsTo10Scale();

// ── Watchlist ──────────────────────────────────────────────────────────

export async function getWatchlist(userId) {
    const rows = db.prepare('SELECT tmdb_id, media_type, details_json, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at DESC').all(userId);
    return rows.map(r => ({
        tmdbId: r.tmdb_id,
        mediaType: r.media_type,
        movieDetails: JSON.parse(r.details_json),
        addedAt: r.added_at > MS_THRESHOLD ? Math.floor(r.added_at / 1000) : r.added_at,
    }));
}

export async function addToWatchlist(userId, tmdbId, movieDetails, mediaType) {
    db.prepare('INSERT OR REPLACE INTO watchlist (user_id, tmdb_id, media_type, details_json, added_at) VALUES (?, ?, ?, ?, ?)')
        .run(userId, String(tmdbId), mediaType || 'movie', JSON.stringify(movieDetails || {}), Math.floor(Date.now() / 1000));
}

export async function removeFromWatchlist(userId, tmdbId) {
    db.prepare('DELETE FROM watchlist WHERE user_id = ? AND tmdb_id = ?').run(userId, String(tmdbId));
}

// ── Progress / Continue Watching ──────────────────────────────────────

export async function getProgress(userId) {
    const rows = db.prepare('SELECT tmdb_id, timestamp, duration, details_json, media_type, source, updated_at FROM progress WHERE user_id = ? ORDER BY updated_at DESC').all(userId);

    const items = rows.map(r => ({
        tmdbId: r.tmdb_id,
        timestamp: r.timestamp,
        duration: r.duration,
        movieDetails: JSON.parse(r.details_json),
        mediaType: r.media_type,
        source: r.source,
        updatedAt: r.updated_at > MS_THRESHOLD ? Math.floor(r.updated_at / 1000) : r.updated_at,
    }));

    const showGroups = new Map();
    const standalone = [];
    for (const item of items) {
        const isTv = item.mediaType === 'tv' || item.tmdbId.startsWith('tv-');
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

export async function saveProgress(userId, tmdbId, timestamp, duration, movieDetails, mediaType, source) {
    if (!duration || duration <= 0) return;
    const percentage = timestamp / duration;
    if (percentage > 0.95) {
        db.prepare('DELETE FROM progress WHERE user_id = ? AND tmdb_id = ?').run(userId, String(tmdbId));
        await addToHistory(userId, tmdbId, movieDetails);
    } else {
        db.prepare('INSERT OR REPLACE INTO progress (user_id, tmdb_id, timestamp, duration, details_json, media_type, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .run(userId, String(tmdbId), timestamp, duration, JSON.stringify(movieDetails || {}), mediaType || 'movie', source || null, Math.floor(Date.now() / 1000));
    }
}

// ── History ────────────────────────────────────────────────────────────

export async function getHistory(userId) {
    const rows = db.prepare('SELECT tmdb_id, details_json, watched_at FROM history WHERE user_id = ? ORDER BY watched_at DESC LIMIT 50').all(userId);
    return rows.map(r => ({
        tmdbId: r.tmdb_id,
        movieDetails: JSON.parse(r.details_json),
        watchedAt: r.watched_at > MS_THRESHOLD ? Math.floor(r.watched_at / 1000) : r.watched_at,
    }));
}

export async function addToHistory(userId, tmdbId, movieDetails) {
    const now = Math.floor(Date.now() / 1000);
    db.prepare('DELETE FROM history WHERE user_id = ? AND tmdb_id = ?').run(userId, String(tmdbId));
    db.prepare('INSERT INTO history (user_id, tmdb_id, details_json, watched_at) VALUES (?, ?, ?, ?)')
        .run(userId, String(tmdbId), JSON.stringify(movieDetails || {}), now);
    // Trim to 50
    db.prepare(`DELETE FROM history WHERE user_id = ? AND id NOT IN (SELECT id FROM history WHERE user_id = ? ORDER BY watched_at DESC LIMIT 50)`).run(userId, userId);
}

export async function removeFromHistory(userId, tmdbId) {
    db.prepare('DELETE FROM history WHERE user_id = ? AND tmdb_id = ?').run(userId, String(tmdbId));
}

// ── Ratings ────────────────────────────────────────────────────────────

export async function getRatings(userId) {
    const rows = db.prepare('SELECT tmdb_id, rating, details_json, thoughts, rated_at FROM ratings WHERE user_id = ?').all(userId);
    const ratings = {};
    for (const r of rows) {
        ratings[r.tmdb_id] = {
            rating: r.rating,
            movieDetails: JSON.parse(r.details_json),
            ratedAt: r.rated_at > MS_THRESHOLD ? Math.floor(r.rated_at / 1000) : r.rated_at,
            thoughts: r.thoughts || '',
        };
    }
    return ratings;
}

export async function saveRating(userId, tmdbId, rating, movieDetails, thoughts) {
    const existing = db.prepare('SELECT rated_at FROM ratings WHERE user_id = ? AND tmdb_id = ?').get(userId, String(tmdbId));
    const ratedAt = existing ? existing.rated_at : Math.floor(Date.now() / 1000);
    db.prepare('INSERT OR REPLACE INTO ratings (user_id, tmdb_id, rating, details_json, thoughts, rated_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, String(tmdbId), rating, JSON.stringify(movieDetails || {}), thoughts || '', ratedAt);
}

export async function deleteRating(userId, tmdbId) {
    db.prepare('DELETE FROM ratings WHERE user_id = ? AND tmdb_id = ?').run(userId, String(tmdbId));
}

// ── Source Preferences ─────────────────────────────────────────────────

export async function getSourcePrefs(userId) {
    const row = db.prepare('SELECT enabled_sources_json, default_source FROM settings WHERE user_id = ?').get(userId);
    return {
        enabled: row ? JSON.parse(row.enabled_sources_json) : [],
        defaultSource: row ? row.default_source : 'videasy',
    };
}

export async function saveSourcePrefs(userId, enabledSources, defaultSource) {
    db.prepare('INSERT OR REPLACE INTO settings (user_id, enabled_sources_json, default_source) VALUES (?, ?, ?)')
        .run(userId, JSON.stringify(enabledSources || []), defaultSource || 'videasy');
}

// ── AI Settings ────────────────────────────────────────────────────────

export async function getAiSettings(userId) {
    const row = db.prepare('SELECT ai_api_key, ai_model FROM settings WHERE user_id = ?').get(userId);
    return {
        apiKey: row ? (row.ai_api_key || '') : '',
        model: row ? (row.ai_model || defaultAiModel) : defaultAiModel,
    };
}

export async function saveAiSettings(userId, settings) {
    db.prepare('INSERT OR REPLACE INTO settings (user_id, ai_api_key, ai_model) VALUES (?, ?, ?)')
        .run(userId, settings.apiKey || '', settings.model || defaultAiModel);
}

// ── Recommendations ────────────────────────────────────────────────────

export async function getRecommendations(userId) {
    const row = db.prepare('SELECT rec_data_json, is_generating, error, generated_at FROM recommendations WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (!row) return null;
    const r = JSON.parse(row.rec_data_json);
    return {
        recommendedMovies: r.recommendedMovies || [],
        recommendedTvShows: r.recommendedTvShows || [],
        madeForYou: r.madeForYou || { movies: [], tv: [] },
        newToYou: r.newToYou || { movies: [], tv: [] },
        isGenerating: !!row.is_generating,
        error: row.error,
        generatedAt: row.generated_at,
    };
}

export async function setGenerationStatus(userId, isGenerating) {
    const existing = db.prepare('SELECT id FROM recommendations WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (existing) {
        db.prepare('UPDATE recommendations SET is_generating = ?, error = CASE WHEN ? THEN NULL ELSE error END WHERE user_id = ?')
            .run(isGenerating ? 1 : 0, isGenerating ? 1 : 0, userId);
    } else {
        db.prepare('INSERT INTO recommendations (user_id, rec_data_json, is_generating) VALUES (?, ?, ?)')
            .run(userId, '{}', isGenerating ? 1 : 0);
    }
}

export async function setGenerationError(userId, errorMsg) {
    const existing = db.prepare('SELECT id FROM recommendations WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (existing) {
        db.prepare('UPDATE recommendations SET is_generating = 0, error = ? WHERE user_id = ?').run(errorMsg, userId);
    } else {
        db.prepare('INSERT INTO recommendations (user_id, rec_data_json, is_generating, error) VALUES (?, ?, 0, ?)')
            .run(userId, '{}', errorMsg);
    }
}

export async function saveRecommendations(userId, recs) {
    const data = {
        recommendedMovies: recs.recommendedMovies || [],
        recommendedTvShows: recs.recommendedTvShows || [],
        madeForYou: recs.madeForYou || { movies: [], tv: [] },
        newToYou: recs.newToYou || { movies: [], tv: [] },
    };
    const existing = db.prepare('SELECT id FROM recommendations WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (existing) {
        db.prepare('UPDATE recommendations SET rec_data_json = ?, is_generating = 0, error = NULL, generated_at = ? WHERE user_id = ?')
            .run(JSON.stringify(data), Math.floor(Date.now() / 1000), userId);
    } else {
        db.prepare('INSERT INTO recommendations (user_id, rec_data_json, is_generating, error, generated_at) VALUES (?, ?, 0, NULL, ?)')
            .run(userId, JSON.stringify(data), Math.floor(Date.now() / 1000));
    }
}