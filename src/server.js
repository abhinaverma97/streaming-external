import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { searchMovies, searchTv, searchMulti, movieDetails, tvDetails, getTrendingMovies, getTrendingTv, getTopRatedMovies, getMoviesByGenre, resolveMediaType } from "./tmdb.js";
import { getWatchlist, addToWatchlist, removeFromWatchlist, getProgress, saveProgress, getHistory, addToHistory, removeFromHistory, getRatings, saveRating } from "./user-db.js";
import { findMovieByImdb, findEpisodeTorrents, buildMagnet } from "./piratebay.js";
import { startSession, getSession, getMimeType, getStatus, stopSession, waitForBuffer, probeSourceDuration, seekToPosition } from "./torrent.js";
import { ensureDir } from "./cache.js";
import { clearHlsDir, ensureHls, getPlaylist, getSegmentPath, stopHls, stopAllHls, getAudioTracks } from "./hls.js";
import { port, downloadsDir } from "./config.js";
import { listMovies, deleteMovie, deleteAllMovies, totalStorageUsed } from "./storage.js";
import { getEnglishVtt, startSubtitleDownload, getSubtitleStatus } from "./subtitles.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Ensure downloads directory exists on startup
ensureDir(downloadsDir);

app.get("/api/search", async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: "Missing q" });
        const page = req.query.page || 1;
        const type = req.query.type || "movie";
        let data;
        if (type === "tv") {
            data = await searchTv(query, page);
        } else if (type === "multi") {
            data = await searchMulti(query, page);
        } else {
            data = await searchMovies(query, page);
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/movie/:tmdbId", async (req, res) => {
    try {
        const tmdbId = req.params.tmdbId;
        const details = await movieDetails(tmdbId);
        const imdbId = details.imdb_id;
        let ytsMovie = null;
        if (imdbId || details.title) {
            let year = "";
            if (details.release_date) {
                year = details.release_date.split("-")[0];
            }
            try {
                ytsMovie = await findMovieByImdb(imdbId, details.title, year);
            } catch (ytsError) {
                console.error("[Backend] Pirate Bay lookup failed for IMDb ID:", imdbId, ytsError.message);
            }
        }
        res.json({ tmdb: details, yts: ytsMovie });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/tv/trending", async (req, res) => {
    try {
        const page = req.query.page || 1;
        const data = await getTrendingTv(page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/tv/:tmdbId", async (req, res) => {
    try {
        const tmdbId = req.params.tmdbId;
        const details = await tvDetails(tmdbId);
        res.json({ tmdb: details });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/tv/:tmdbId/season/:season/episode/:episode", async (req, res) => {
    try {
        const { tmdbId, season, episode } = req.params;
        const details = await tvDetails(tmdbId);
        const showName = details.name;
        const torrentData = await findEpisodeTorrents(showName, Number(season), Number(episode));
        res.json({ tmdb: details, yts: torrentData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── TMDB Movie Feeds ────────────────────────────────────────────────────────

app.get("/api/movies/trending", async (req, res) => {
    try {
        const page = req.query.page || 1;
        const data = await getTrendingMovies(page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.get("/api/movies/top-rated", async (req, res) => {
    try {
        const page = req.query.page || 1;
        const data = await getTopRatedMovies(page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/movies/genre/:genreId", async (req, res) => {
    try {
        const genreId = req.params.genreId;
        const page = req.query.page || 1;
        const data = await getMoviesByGenre(genreId, page);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Watchlist, Continue Watching, History ──────────────────────────────────

app.get("/api/watchlist", (req, res) => {
    try {
        res.json(getWatchlist());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/watchlist", (req, res) => {
    try {
        const { imdbId, movieDetails, mediaType } = req.body;
        if (!imdbId) return res.status(400).json({ error: "Missing imdbId" });
        addToWatchlist(imdbId, movieDetails, mediaType);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/watchlist/:imdbId", (req, res) => {
    try {
        removeFromWatchlist(req.params.imdbId);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/resolve-media-type/:imdbId", async (req, res) => {
    try {
        const mediaType = await resolveMediaType(req.params.imdbId);
        res.json({ mediaType });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/continue-watching", (req, res) => {
    try {
        res.json(getProgress());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/progress", (req, res) => {
    try {
        const { imdbId, timestamp, duration, movieDetails, mediaType, sessionId } = req.body;
        if (!imdbId || timestamp === undefined) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        // Use sourceDuration from session if available (true movie length, not HLS playlist length)
        let finalDuration = Number(duration);
        if (sessionId) {
            const session = getSession(sessionId);
            if (session?.sourceDuration) {
                finalDuration = session.sourceDuration;
            }
        }
        if (!finalDuration) {
            return res.status(400).json({ error: "Duration unavailable" });
        }
        saveProgress(imdbId, Number(timestamp), finalDuration, movieDetails, mediaType);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/history", (req, res) => {
    try {
        res.json(getHistory());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/history", (req, res) => {
    try {
        const { imdbId, movieDetails } = req.body;
        if (!imdbId) return res.status(400).json({ error: "Missing imdbId" });
        addToHistory(imdbId, movieDetails);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/history/:imdbId", (req, res) => {
    try {
        removeFromHistory(req.params.imdbId);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Ratings ─────────────────────────────────────────────────────────────
app.get("/api/ratings", (req, res) => {
    try {
        res.json(getRatings());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/ratings/:id", (req, res) => {
    try {
        const { rating, movieDetails } = req.body;
        if (typeof rating !== "number" || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Invalid rating" });
        }
        saveRating(req.params.id, rating, movieDetails);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/movie/:imdbId/english-sub", async (req, res) => {
    try {
        const vtt = await getEnglishVtt(req.params.imdbId);
        res.setHeader("Content-Type", "text/vtt; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=31536000");
        res.send(vtt);
    } catch (error) {
        // Just return 404 if no subs found, frontend can ignore
        res.status(404).json({ error: error.message });
    }
});

app.post("/api/movie/:imdbId/subtitle-start", (req, res) => {
    try {
        startSubtitleDownload(req.params.imdbId);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/movie/:imdbId/subtitle-status", (req, res) => {
    try {
        const status = getSubtitleStatus(req.params.imdbId);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/stream/start", async (req, res) => {
    try {
        const { imdbId, quality, hash, title } = req.body;
        
        let selectedHash = hash;
        let selectedTitle = title;

        if (!selectedHash) {
            if (!imdbId) return res.status(400).json({ error: "Missing imdbId or hash" });

            const ytsMovie = await findMovieByImdb(imdbId);
            if (!ytsMovie || !ytsMovie.torrents || !ytsMovie.torrents.length) {
                return res.status(404).json({ error: "No torrents found" });
            }

            const selected = quality
                ? (ytsMovie.torrents.find((torrent) => torrent.quality === quality) ||
                   ytsMovie.torrents.find((torrent) => torrent.quality.toLowerCase().includes(quality.toLowerCase())) ||
                   ytsMovie.torrents[0])
                : ytsMovie.torrents[0];

            if (!selected) return res.status(404).json({ error: "Requested quality not found" });
            selectedHash = selected.hash;
            selectedTitle = ytsMovie.title_long || ytsMovie.title;
        }

        const magnet = buildMagnet({
            hash: selectedHash,
            name: selectedTitle || "stream"
        });

        const session = await startSession(magnet);
        // Start HLS in the background after waiting for pre-buffer to avoid transcoder stalls
        waitForBuffer(session).then(() => {
            ensureHls(session).catch(err => console.log("[ensureHls] bg error:", err.message));
            // Probe source duration after buffer is ready (file exists on disk)
            probeSourceDuration(session);
        });
        
        res.json({
            sessionId: session.id,
            streamUrl: `/api/stream/${session.id}`,
            hlsUrl: `/api/stream/${session.id}/hls/index.m3u8`,
            sourceDuration: session.sourceDuration || null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/stream/:sessionId", (req, res) => {
    try {
        const session = getSession(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const file = session.file;
        const range = req.headers.range;
        if (!range) {
            res.writeHead(200, {
                "Content-Length": file.length,
                "Content-Type": getMimeType(file.name),
                "Accept-Ranges": "bytes"
            });
            const stream = file.createReadStream();
            stream.on("error", () => {}); // Ignore premature close errors when client disconnects
            stream.pipe(res);
            return;
        }

        const bytesPrefix = "bytes=";
        if (!range.startsWith(bytesPrefix)) {
            res.status(416).json({ error: "Invalid range" });
            return;
        }

        const [startStr, endStr] = range.replace(bytesPrefix, "").split("-");
        const start = Number(startStr);
        const end = endStr ? Number(endStr) : file.length - 1;

        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
            res.status(416).json({ error: "Invalid range values" });
            return;
        }

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${file.length}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": getMimeType(file.name)
        });

        const stream = file.createReadStream({ start, end });
        stream.on("error", () => {}); // Ignore premature close errors when client disconnects
        stream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/stream/:sessionId/subs", (req, res) => {
    try {
        const session = getSession(req.params.sessionId);
        if (!session || !session.torrent) return res.json([]);
        
        const subs = session.torrent.files
            .map((f, index) => ({ 
                name: f.name, 
                path: f.path, 
                index, 
                downloaded: f.downloaded >= f.length 
            }))
            .filter(f => f.name.toLowerCase().endsWith('.srt') || f.name.toLowerCase().endsWith('.vtt'));
        
        res.json(subs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/stream/:sessionId/subs/:fileIndex", (req, res) => {
    try {
        const session = getSession(req.params.sessionId);
        if (!session || !session.torrent) return res.status(404).send("Session not found");
        
        const fileIndex = parseInt(req.params.fileIndex, 10);
        const file = session.torrent.files[fileIndex];
        if (!file) return res.status(404).send("File not found");
        
        res.setHeader("Content-Type", "text/vtt; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
        res.setHeader("Cache-Control", "public, max-age=3600");
        
        file.getBuffer((err, buffer) => {
            if (err) return res.status(500).send("Error reading subtitle file");
            
            let content = buffer.toString('utf-8');
            
            if (file.name.toLowerCase().endsWith('.srt')) {
                // Strip BOM if present
                content = content.replace(/^\uFEFF/, '');
                content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                content = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
                if (!content.startsWith('WEBVTT')) {
                    content = "WEBVTT\n\n" + content;
                }
            }
            
            res.send(content);
        });
    } catch (error) {
        res.status(500).send("Error: " + error.message);
    }
});

app.get("/api/stream/:sessionId/status", (req, res) => {
    const session = getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(getStatus(session));
});

app.get("/api/stream/:sessionId/audio-tracks", async (req, res) => {
    try {
        const tracks = await getAudioTracks(req.params.sessionId);
        res.json(tracks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/stream/:sessionId/hls/index.m3u8", async (req, res) => {
    try {
        const session = getSession(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const audioTrack = req.query.audioTrack !== undefined ? Number(req.query.audioTrack) : 0;
        const startTime = req.query.startTime !== undefined ? Number(req.query.startTime) : 0;
        await ensureHls(session, audioTrack, startTime);
        const playlistPath = getPlaylist(session.id);

        if (!fs.existsSync(playlistPath)) {
            res.status(204).set("Retry-After", "2").end();
            return;
        }

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        fs.createReadStream(playlistPath).pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/stream/:sessionId/seek", async (req, res) => {
    try {
        const session = getSession(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const { time, audioTrack = 0 } = req.body;
        if (time === undefined || typeof time !== "number" || time < 0) {
            return res.status(400).json({ error: "Invalid seek time" });
        }

        console.log(`[seek] Session ${session.id}: seeking to ${time}s`);

        // Reprioritize torrent pieces near the seek position
        seekToPosition(session, time);

        // Restart HLS from the seek position
        await ensureHls(session, audioTrack, time);

        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/stream/:sessionId/hls/:segment", (req, res) => {
    try {
        const session = getSession(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session not found" });

        const segmentPath = getSegmentPath(session.id, req.params.segment);
        if (!fs.existsSync(segmentPath)) {
            res.status(404).json({ error: "Segment not found" });
            return;
        }

        res.setHeader("Content-Type", getMimeType(req.params.segment));
        fs.createReadStream(segmentPath).pipe(res);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/stream/stop", async (req, res) => {
    try {
        const { sessionId } = req.body || {};
        if (sessionId) {
            stopHls(sessionId);
            await stopSession(sessionId);
        } else {
            // Kill ffmpeg first so it releases any file handles
            stopAllHls();
            await stopSession();
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Storage management ──────────────────────────────────────────────────────

app.get("/api/storage", (req, res) => {
    try {
        const movies = listMovies();
        res.json({
            totalBytes: totalStorageUsed(),
            movies
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete("/api/storage/movie/:name", (req, res) => {
    try {
        deleteMovie(req.params.name);
        res.json({ ok: true });
    } catch (error) {
        const status = error.message === "Not found" ? 404 : 400;
        res.status(status).json({ error: error.message });
    }
});

app.delete("/api/storage/all", async (req, res) => {
    try {
        // Stop any active torrent session first so files aren't locked
        await stopSession();
        clearHlsDir();
        deleteAllMovies();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/health", (req, res) => {
    res.json({ ok: true });
});

app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
});
