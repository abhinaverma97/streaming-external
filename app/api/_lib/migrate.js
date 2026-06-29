import fs from 'fs';
import path from 'path';
import db from './db.js';
import { hashPassword } from './auth.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.cache');
const DATA_FILE = path.join(DATA_DIR, 'user-data.json');
const seedFile = path.join(process.cwd(), 'data', 'seed.json');

function seedFromFile() {
    const existingRatings = db.prepare('SELECT COUNT(*) as count FROM ratings').get();
    if (existingRatings.count > 0) return;

    if (!fs.existsSync(seedFile)) return;

    try {
        const seed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        let userId = db.prepare('SELECT id FROM users LIMIT 1').get()?.id;

        if (!userId) {
            const passwordHash = hashPassword('pass');
            const result = db.prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)').run('abhi', passwordHash);
            userId = Number(result.lastInsertRowid) || db.prepare("SELECT id FROM users WHERE username = 'abhi'").get()?.id;
        }

        if (!userId) return;

        if (seed.ratings && Array.isArray(seed.ratings)) {
            const insert = db.prepare('INSERT OR IGNORE INTO ratings (user_id, tmdb_id, rating, details_json, thoughts, rated_at) VALUES (?, ?, ?, ?, ?, ?)');
            const tx = db.transaction((items) => {
                for (const [key, value] of items) {
                    insert.run(userId, String(value.tmdbId || key), value.rating || 1, JSON.stringify(value.movieDetails || {}), value.thoughts || '', value.ratedAt || Math.floor(Date.now() / 1000));
                }
            });
            tx(seed.ratings);
        }

        if (seed.watchlist && Array.isArray(seed.watchlist)) {
            const insert = db.prepare('INSERT OR IGNORE INTO watchlist (user_id, tmdb_id, media_type, details_json, added_at) VALUES (?, ?, ?, ?, ?)');
            const tx = db.transaction((items) => {
                for (const [key, value] of items) {
                    insert.run(userId, String(value.tmdbId || key), value.mediaType || 'movie', JSON.stringify(value.movieDetails || {}), value.addedAt || Math.floor(Date.now() / 1000));
                }
            });
            tx(seed.watchlist);
        }

        console.log('[Migrate] Seeded from data/seed.json');
    } catch (e) {
        console.error('[Migrate] Seed failed:', e.message);
    }
}

export function migrateIfNeeded() {
    const flag = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migration'").get();
    if (flag) return;

    db.exec("CREATE TABLE IF NOT EXISTS _migration (done INTEGER)");

    if (!fs.existsSync(DATA_FILE)) {
        db.prepare("INSERT INTO _migration (done) VALUES (1)").run();
        seedFromFile();
        return;
    }

    console.log('[Migrate] Found user-data.json, migrating to SQLite...');

    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(raw);

        const passwordHash = hashPassword('pass');
        let result = db.prepare('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)').run('abhi', passwordHash);
        let userId = Number(result.lastInsertRowid);
        if (userId === 0) userId = db.prepare("SELECT id FROM users WHERE username = 'abhi'").get()?.id;
        if (!userId) throw new Error('Failed to create or find user');

        // Migrate watchlist
        if (data.watchlist && Array.isArray(data.watchlist)) {
            const insert = db.prepare('INSERT OR IGNORE INTO watchlist (user_id, tmdb_id, media_type, details_json, added_at) VALUES (?, ?, ?, ?, ?)');
            const tx = db.transaction((items) => {
                for (const [key, value] of items) {
                    insert.run(userId, String(value.tmdbId || key), value.mediaType || 'movie', JSON.stringify(value.movieDetails || {}), value.addedAt || Math.floor(Date.now() / 1000));
                }
            });
            tx(data.watchlist);
        }

        // Migrate ratings
        if (data.ratings && Array.isArray(data.ratings)) {
            const insert = db.prepare('INSERT OR IGNORE INTO ratings (user_id, tmdb_id, rating, details_json, thoughts, rated_at) VALUES (?, ?, ?, ?, ?, ?)');
            const tx = db.transaction((items) => {
                for (const [key, value] of items) {
                    const r = typeof value === 'object' ? (value.rating || 1) : value;
                    const details = (typeof value === 'object' && value.movieDetails) || {};
                    const thoughts = (typeof value === 'object' && value.thoughts) || '';
                    insert.run(userId, String(value.tmdbId || key), r, JSON.stringify(details), thoughts, (typeof value === 'object' ? value.ratedAt : null) || Math.floor(Date.now() / 1000));
                }
            });
            tx(data.ratings);
        }

        // Migrate progress
        if (data.progress && Array.isArray(data.progress)) {
            const insert = db.prepare('INSERT OR IGNORE INTO progress (user_id, tmdb_id, timestamp, duration, details_json, media_type, source, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            const tx = db.transaction((items) => {
                for (const [key, value] of items) {
                    insert.run(userId, String(value.tmdbId || key), value.timestamp || 0, value.duration || 0, JSON.stringify(value.movieDetails || {}), value.mediaType || 'movie', value.source || null, value.updatedAt || Math.floor(Date.now() / 1000));
                }
            });
            tx(data.progress);
        }

        // Migrate history
        if (data.history && Array.isArray(data.history)) {
            const insert = db.prepare('INSERT OR IGNORE INTO history (user_id, tmdb_id, details_json, watched_at) VALUES (?, ?, ?, ?)');
            const tx = db.transaction((items) => {
                for (const item of items) {
                    insert.run(userId, String(item.tmdbId), JSON.stringify(item.movieDetails || {}), item.watchedAt || Math.floor(Date.now() / 1000));
                }
            });
            tx(data.history);
        }

        // Migrate settings
        if (data.settings) {
            db.prepare('INSERT OR IGNORE INTO settings (user_id, enabled_sources_json, default_source, ai_api_key, ai_model) VALUES (?, ?, ?, ?, ?)')
                .run(userId,
                    JSON.stringify(data.settings.enabledSources || []),
                    data.settings.defaultSource || 'videasy',
                    data.settings.aiApiKey || '',
                    data.settings.aiModel || '');
        }

        // Migrate recommendations
        if (data.recommendations) {
            db.prepare('INSERT OR IGNORE INTO recommendations (user_id, rec_data_json, is_generating, error, generated_at) VALUES (?, ?, ?, ?, ?)')
                .run(userId,
                    JSON.stringify(data.recommendations),
                    data.recommendations?.isGenerating ? 1 : 0,
                    data.recommendations?.error || null,
                    data.recommendations?.generatedAt || null);
        }

        db.prepare("INSERT INTO _migration (done) VALUES (1)").run();

        try { fs.renameSync(DATA_FILE, DATA_FILE + '.migrated'); } catch (e) { /* ok */ }
        console.log('[Migrate] Migration complete. Old data backed up to user-data.json.migrated');
    } catch (e) {
        console.error('[Migrate] Migration failed:', e.message);
    }

    seedFromFile();
}

const MS_THRESHOLD = 1000000000000;

export function migrateTimestampsIfNeeded() {
    const flag = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_v2'").get();
    if (flag) return;

    const runMigration = db.transaction(() => {
        db.exec("CREATE TABLE IF NOT EXISTS _migration_v2 (done INTEGER UNIQUE)");
        const claim = db.prepare("INSERT OR IGNORE INTO _migration_v2 (done) VALUES (1)").run();
        if (claim.changes === 0) return;

        const tables = [
            { table: 'ratings', column: 'rated_at' },
            { table: 'watchlist', column: 'added_at' },
            { table: 'progress', column: 'updated_at' },
            { table: 'history', column: 'watched_at' },
        ];

        let fixed = 0;
        for (const { table, column } of tables) {
            const result = db.prepare(`UPDATE ${table} SET ${column} = ${column} / 1000 WHERE ${column} > ?`).run(MS_THRESHOLD);
            fixed += result.changes;
        }

        console.log(`[Migrate] V2 timestamp migration complete — fixed ${fixed} rows`);
    });

    runMigration();
}

export function migrateRatingsTo10Scale() {
    const flag = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migration_v3'").get();
    if (flag) return;

    const runMigration = db.transaction(() => {
        db.exec("CREATE TABLE IF NOT EXISTS _migration_v3 (done INTEGER UNIQUE)");
        const claim = db.prepare("INSERT OR IGNORE INTO _migration_v3 (done) VALUES (1)").run();
        if (claim.changes === 0) return;

        // Data is already in 1-10 scale from the first deployment.
        // Only the schema needs fixing — recreate with the correct CHECK.
        db.exec(`
            CREATE TABLE IF NOT EXISTS ratings_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                tmdb_id TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
                details_json TEXT NOT NULL DEFAULT '{}',
                thoughts TEXT NOT NULL DEFAULT '',
                rated_at INTEGER NOT NULL DEFAULT (unixepoch()),
                UNIQUE(user_id, tmdb_id)
            );
        `);
        db.exec('INSERT OR IGNORE INTO ratings_new SELECT * FROM ratings');
        db.exec('DROP TABLE ratings');
        db.exec('ALTER TABLE ratings_new RENAME TO ratings');
        console.log('[Migrate] V3 rating scale migration complete — table recreated with 1-10 CHECK constraint');
    });

    runMigration();
}
