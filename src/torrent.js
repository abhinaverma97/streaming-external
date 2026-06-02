import path from "path";
import crypto from "crypto";
import WebTorrent from "webtorrent";
import mime from "mime-types";
import { downloadsDir, trackers, port } from "./config.js";
import { ensureDir } from "./cache.js";
import { totalStorageUsed, deleteAllMovies, MAX_STORAGE_BYTES } from "./storage.js";
import { clearHlsDir } from "./hls.js";
import fs from "fs";
import { execFile } from "child_process";
import util from "util";

const execFileAsync = util.promisify(execFile);

const client = new WebTorrent({ utp: false, maxConns: 300, dht: true, pex: true });
let activeSession = null;

function createSessionId() {
    return crypto.randomUUID();
}

function selectBestFile(files) {
    if (!files || files.length === 0) return null;
    const videoExts = new Set([".mkv", ".mp4", ".webm", ".avi"]);
    const videoFiles = files.filter((file) => videoExts.has(path.extname(file.name).toLowerCase()));
    const candidates = videoFiles.length ? videoFiles : files;
    if (candidates.length === 0) return null;
    return candidates.reduce((best, current) => (current.length > best.length ? current : best));
}

function prioritizeSubtitles(torrent) {
    const subExts = new Set([".srt", ".vtt"]);
    for (const file of torrent.files) {
        if (subExts.has(path.extname(file.name).toLowerCase())) {
            const start = file.offset;
            const end = start + file.length;
            const bytesPerPiece = torrent.pieceLength;
            const startPiece = Math.floor(start / bytesPerPiece);
            const endPiece = Math.min(torrent.pieces.length - 1, Math.ceil(end / bytesPerPiece) - 1);
            torrent.critical(startPiece, endPiece);
        }
    }
}

function prioritizeStartup(torrent, file) {
    if (!file) return;
    const totalPieces = torrent.pieces.length;
    const bytesPerPiece = torrent.pieceLength;
    const startupBytes = Math.min(file.length, 50 * 1024 * 1024);
    const startupPieces = Math.ceil(startupBytes / bytesPerPiece);
    const endPiece = Math.min(totalPieces - 1, startupPieces);

    // Prioritize subtitle files first
    prioritizeSubtitles(torrent);

    // Prioritize the beginning of the file
    torrent.critical(0, endPiece);

    // Prioritize the end of the file (important for MP4 moov atom)
    const endBytes = Math.min(file.length, 5 * 1024 * 1024); // last 5MB
    const endPiecesStart = Math.max(0, Math.floor((file.length - endBytes) / bytesPerPiece));
    torrent.critical(endPiecesStart, totalPieces - 1);

    // Sequential streaming
    torrent.select(0, totalPieces - 1, 0);
}

async function startSession(magnet) {
    const currentStorage = totalStorageUsed();
    if (currentStorage > MAX_STORAGE_BYTES) {
        console.log(`[STORAGE] Limit exceeded (${Math.round(currentStorage/1024/1024/1024)}GB). Purging downloads and cache...`);
        deleteAllMovies();
        clearHlsDir();
    }

    if (activeSession) {
        // Fire-and-forget background destruction to prevent blocking
        stopSession();
    }

    ensureDir(downloadsDir);

    const sessionId = createSessionId();
    const session = {
        id: sessionId,
        createdAt: Date.now(),
        lastAccess: Date.now(),
        torrent: null,
        file: null
    };

    await new Promise((resolve, reject) => {
        let resolved = false;
        
        const hashMatch = magnet.match(/urn:btih:([^&]+)/i);
        const hash = hashMatch ? hashMatch[1].toLowerCase() : null;
        const torrentFilePath = hash ? path.join(downloadsDir, `${hash}.torrent`) : null;
        
        let addTarget = magnet;
        
        // Append optimized trackers to magnet link
        if (typeof addTarget === 'string' && addTarget.startsWith('magnet:')) {
            const trStrings = trackers.map(tr => `tr=${encodeURIComponent(tr)}`).join('&');
            if (trStrings) {
                addTarget = addTarget.includes('&tr=') ? addTarget : `${addTarget}&${trStrings}`;
            }
        }
        if (torrentFilePath && fs.existsSync(torrentFilePath)) {
            addTarget = fs.readFileSync(torrentFilePath);
        }

        const torrent = client.add(addTarget, { path: downloadsDir });

        if (torrentFilePath && !fs.existsSync(torrentFilePath)) {
            torrent.on('metadata', () => {
                try {
                    fs.writeFileSync(torrentFilePath, torrent.torrentFile);
                } catch (e) {}
            });
        }

        const onReady = () => {
            if (resolved) return;
            resolved = true;
            session.torrent = torrent;
            session.file = selectBestFile(torrent.files);
            if (session.file) {
                session.file.select();
                prioritizeStartup(torrent, session.file);
                resolve();
            } else {
                reject(new Error("No files found in torrent"));
            }
        };

        const onError = (err) => {
            if (resolved) return;
            resolved = true;
            reject(err);
        };

        if (torrent.ready) {
            onReady();
        } else {
            torrent.once("ready", onReady);
        }

        torrent.once("error", onError);
    });

    activeSession = session;
    return session;
}

async function stopSession(sessionId = null) {
    if (!activeSession) return;
    if (sessionId && activeSession.id !== sessionId) return;

    if (!activeSession.torrent) {
        activeSession = null;
        return;
    }

    const torrent = activeSession.torrent;
    activeSession = null;

    // Do NOT await the destroy callback! Let it happen seamlessly in the background.
    torrent.destroy({ destroyStore: true }, () => {
        console.log("Background torrent destruction complete.");
    });
}

function getSession(sessionId) {
    if (!activeSession || activeSession.id !== sessionId) return null;
    activeSession.lastAccess = Date.now();
    return activeSession;
}

function getMimeType(fileName) {
    return mime.lookup(fileName) || "application/octet-stream";
}

function getStatus(session) {
    const torrent = session.torrent;
    return {
        id: session.id,
        name: session.file ? session.file.name : "Unknown",
        length: session.file ? session.file.length : 0,
        progress: torrent ? torrent.progress : 0,
        downloaded: torrent ? torrent.downloaded : 0,
        downloadSpeed: torrent ? torrent.downloadSpeed : 0,
        numPeers: torrent ? torrent.numPeers : 0,
        timeRemaining: torrent ? torrent.timeRemaining : 0,
        sourceDuration: session.sourceDuration || null
    };
}

function estimateDuration(file) {
    // Fallback: assume ~4 Mbps average bitrate to estimate duration from file size
    return file.length / 524288; // bytes / (4 Mbps in bytes/sec ≈ 524288 B/s)
}

function seekToPosition(session, seekTime) {
    if (!session.file || !session.torrent) return;
    const file = session.file;
    const torrent = session.torrent;
    let duration = session.sourceDuration;
    if (!duration || duration <= 0) {
        duration = estimateDuration(file);
        console.log(`[seek] sourceDuration unavailable, using estimate ${duration.toFixed(1)}s from file size`);
    }

    const byteOffset = Math.max(0, (seekTime / duration) * file.length);
    const bytesPerPiece = torrent.pieceLength;
    const targetPiece = Math.floor(byteOffset / bytesPerPiece);
    const totalPieces = torrent.pieces.length;

    const windowBytes = 5 * 1024 * 1024;
    const windowPieces = Math.ceil(windowBytes / bytesPerPiece);
    const startPiece = Math.max(0, targetPiece - windowPieces);
    const endPiece = Math.min(totalPieces - 1, targetPiece + windowPieces);

    const endBytes = Math.min(file.length, 5 * 1024 * 1024);
    const endPiecesStart = Math.max(0, Math.floor((file.length - endBytes) / bytesPerPiece));

    torrent.select(0, totalPieces - 1, 0);
    torrent.critical(startPiece, endPiece);
    torrent.critical(endPiecesStart, totalPieces - 1);

    console.log(`[seek] Prioritized pieces ${startPiece}-${endPiece} at byte offset ~${Math.round(byteOffset / 1024 / 1024)}MB`);
}

async function probeSourceDuration(session) {
    if (!session.file) return null;
    const streamUrl = `http://127.0.0.1:${port}/api/stream/${session.id}`;

    for (let i = 0; i < 3; i++) {
        try {
            const { stdout } = await execFileAsync("ffprobe", [
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                streamUrl
            ], { timeout: 6000 });
            const duration = parseFloat(stdout.trim());
            if (duration && isFinite(duration) && duration > 0) {
                session.sourceDuration = duration;
                console.log(`[ffprobe] Source duration for ${session.id}: ${duration}s`);
                return duration;
            }
        } catch (e) {
            console.log(`[ffprobe] Retry ${i + 1}/3 for ${session.id}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log(`[ffprobe] Failed to determine source duration for ${session.id} after 3 attempts`);
    return null;
}

async function waitForBuffer(session, minPercent = 0.02, minBytes = 1 * 1024 * 1024) {
    if (!session || !session.torrent || !session.file) return;
    const targetBytes = Math.min(minBytes, session.file.length * minPercent);

    return new Promise((resolve) => {
        let timer;
        const check = () => {
            const totalReadyBytes = session.torrent.progress * session.torrent.length;
            if (totalReadyBytes >= targetBytes || session.torrent.progress === 1) {
                session.torrent.removeListener("download", check);
                clearTimeout(timer);
                resolve();
            }
        };
        session.torrent.on("download", check);
        check();

        timer = setTimeout(() => {
            session.torrent.removeListener("download", check);
            resolve();
        }, 30000);
    });
}

export { startSession, stopSession, getSession, getMimeType, getStatus, probeSourceDuration, waitForBuffer, seekToPosition };

