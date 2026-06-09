import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbDir = path.join(process.cwd(), ".cache");
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "database.sqlite");

// Initialize db connection
const db = new Database(dbPath, {
    // verbose: console.log
});

// Enable WAL mode for better concurrency performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        lastActive INTEGER
    );

    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        tmdbId TEXT NOT NULL,
        mediaType TEXT,
        movieDetails TEXT,
        addedAt INTEGER NOT NULL,
        UNIQUE(username, tmdbId)
    );

    CREATE TABLE IF NOT EXISTS progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        tmdbId TEXT NOT NULL,
        timestamp REAL NOT NULL,
        duration REAL NOT NULL,
        movieDetails TEXT,
        mediaType TEXT,
        source TEXT,
        updatedAt INTEGER NOT NULL,
        UNIQUE(username, tmdbId)
    );

    CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        tmdbId TEXT NOT NULL,
        movieDetails TEXT,
        watchedAt INTEGER NOT NULL,
        UNIQUE(username, tmdbId)
    );

    CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        tmdbId TEXT NOT NULL,
        rating REAL NOT NULL,
        movieDetails TEXT,
        ratedAt INTEGER NOT NULL,
        UNIQUE(username, tmdbId)
    );

    CREATE TABLE IF NOT EXISTS settings (
        username TEXT PRIMARY KEY,
        aiApiKey TEXT,
        aiModel TEXT,
        defaultSource TEXT,
        enabledSources TEXT
    );

    CREATE TABLE IF NOT EXISTS recommendations (
        username TEXT PRIMARY KEY,
        recommendedMovies TEXT,
        recommendedTvShows TEXT,
        isGenerating INTEGER DEFAULT 0,
        error TEXT,
        generatedAt INTEGER
    );
`);

// Migrations
try {
    db.exec(`ALTER TABLE ratings ADD COLUMN thoughts TEXT;`);
} catch (e) {
    // Ignore error if column already exists
}

export default db;
