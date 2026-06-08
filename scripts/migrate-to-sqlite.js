const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const cacheDir = path.join(process.cwd(), '.cache');
const usersFile = path.join(cacheDir, 'users.json');
const dataFile = path.join(cacheDir, 'user-data.json');
const dbFile = path.join(cacheDir, 'database.sqlite');

if (!fs.existsSync(usersFile) && !fs.existsSync(dataFile)) {
    console.log('[Migrate] No legacy JSON data found. Skipping migration.');
    process.exit(0);
}

console.log('[Migrate] Starting migration from JSON to SQLite...');

const db = new Database(dbFile);

// Ensure tables exist (same schema as db.ts)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, hash TEXT NOT NULL, salt TEXT NOT NULL, createdAt INTEGER NOT NULL, lastActive INTEGER);
  CREATE TABLE IF NOT EXISTS watchlists (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, tmdbId TEXT NOT NULL, mediaType TEXT, movieDetails TEXT, addedAt INTEGER NOT NULL, UNIQUE(username, tmdbId));
  CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, tmdbId TEXT NOT NULL, movieDetails TEXT, watchedAt INTEGER NOT NULL, UNIQUE(username, tmdbId));
  CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, tmdbId TEXT NOT NULL, timestamp REAL NOT NULL, duration REAL NOT NULL, movieDetails TEXT, mediaType TEXT, source TEXT, updatedAt INTEGER NOT NULL, UNIQUE(username, tmdbId));
  CREATE TABLE IF NOT EXISTS ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, tmdbId TEXT NOT NULL, rating REAL NOT NULL, movieDetails TEXT, ratedAt INTEGER NOT NULL, UNIQUE(username, tmdbId));
  CREATE TABLE IF NOT EXISTS recommendations (username TEXT PRIMARY KEY, recommendedMovies TEXT, recommendedTvShows TEXT, isGenerating INTEGER DEFAULT 0, error TEXT, generatedAt INTEGER);
  CREATE TABLE IF NOT EXISTS settings (username TEXT PRIMARY KEY, aiApiKey TEXT, aiModel TEXT, defaultSource TEXT, enabledSources TEXT);
`);

const crypto = require('crypto');
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, hash, salt, createdAt, lastActive) VALUES (?, ?, ?, ?, ?)');
const insertWatchlist = db.prepare('INSERT OR REPLACE INTO watchlists (username, tmdbId, mediaType, movieDetails, addedAt) VALUES (?, ?, ?, ?, ?)');
const insertHistory = db.prepare('INSERT OR REPLACE INTO history (username, tmdbId, movieDetails, watchedAt) VALUES (?, ?, ?, ?)');
const insertProgress = db.prepare('INSERT OR REPLACE INTO progress (username, tmdbId, timestamp, duration, movieDetails, mediaType, source, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const insertRating = db.prepare('INSERT OR REPLACE INTO ratings (username, tmdbId, rating, movieDetails, ratedAt) VALUES (?, ?, ?, ?, ?)');

db.transaction(() => {
    // Migrate Users
    if (fs.existsSync(usersFile)) {
        try {
            const usersData = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
            if (usersData.users && Array.isArray(usersData.users)) {
                for (const u of usersData.users) {
                    const { hash, salt } = hashPassword(u.password);
                    insertUser.run(u.username, hash, salt, u.createdAt || Date.now(), u.lastActive || null);
                }
                console.log(`[Migrate] Migrated ${usersData.users.length} users.`);
            }
        } catch (e) {
            console.error('[Migrate] Error migrating users.json:', e.message);
        }
    }

    // Migrate User Data
    if (fs.existsSync(dataFile)) {
        try {
            const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            for (const [username, userData] of Object.entries(data)) {
                // Watchlist
                if (userData.watchlist) {
                    for (const item of userData.watchlist) {
                        const mt = item.mediaType || item.movieDetails?.media_type || 'movie';
                        insertWatchlist.run(username, String(item.tmdbId), mt, JSON.stringify(item.movieDetails || {}), item.addedAt || Date.now());
                    }
                }
                // History
                if (userData.history) {
                    for (const item of userData.history) {
                        insertHistory.run(username, String(item.tmdbId), JSON.stringify(item.movieDetails || {}), item.watchedAt || Date.now());
                    }
                }
                // Progress
                if (userData.continueWatching) {
                    for (const item of userData.continueWatching) {
                        const mt = item.mediaType || item.movieDetails?.media_type || 'movie';
                        insertProgress.run(username, String(item.tmdbId), item.timestamp || 0, item.duration || 1, JSON.stringify(item.movieDetails || {}), mt, item.source || null, item.updatedAt || Date.now());
                    }
                }
                // Ratings
                if (userData.ratings) {
                    for (const [id, item] of Object.entries(userData.ratings)) {
                        if (!item) continue;
                        insertRating.run(username, String(id), item.rating || 0, JSON.stringify(item.movieDetails || {}), item.ratedAt || Date.now());
                    }
                }
            }
            console.log('[Migrate] Migrated user-data.json lists and ratings.');
        } catch (e) {
            console.error('[Migrate] Error migrating user-data.json:', e.message);
        }
    }
})();

// Rename files to prevent running again
if (fs.existsSync(usersFile)) {
    fs.renameSync(usersFile, usersFile + '.migrated');
}
if (fs.existsSync(dataFile)) {
    fs.renameSync(dataFile, dataFile + '.migrated');
}

console.log('[Migrate] Migration complete! Legacy JSON files have been renamed.');
process.exit(0);
