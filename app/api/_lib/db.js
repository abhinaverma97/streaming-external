import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.cache');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'movie',
    details_json TEXT NOT NULL DEFAULT '{}',
    added_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, tmdb_id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
    details_json TEXT NOT NULL DEFAULT '{}',
    thoughts TEXT NOT NULL DEFAULT '',
    rated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, tmdb_id)
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    timestamp REAL NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    details_json TEXT NOT NULL DEFAULT '{}',
    media_type TEXT NOT NULL DEFAULT 'movie',
    source TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, tmdb_id)
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    watched_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, tmdb_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled_sources_json TEXT NOT NULL DEFAULT '[]',
    default_source TEXT NOT NULL DEFAULT 'videasy',
    ai_api_key TEXT NOT NULL DEFAULT '',
    ai_model TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rec_data_json TEXT NOT NULL DEFAULT '{}',
    is_generating INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    generated_at INTEGER
  );
`);

export default db;