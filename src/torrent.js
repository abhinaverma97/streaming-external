import path from "path";
import crypto from "crypto";
import WebTorrent from "webtorrent";
import mime from "mime-types";
import { downloadsDir, trackers } from "./config.js";
import { ensureDir } from "./cache.js";
import { totalStorageUsed, deleteAllMovies, MAX_STORAGE_BYTES } from "./storage.js";
import { clearHlsDir } from "./hls.js";
import fs from "fs";

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

function prioritizeStartup(torrent, file) {
    if (!file) return;
    const totalPieces = torrent.pieces.length;
    const bytesPerPiece = torrent.pieceLength;
    const startupBytes = Math.min(file.length, 50 * 1024 * 1024);
    const startupPieces = Math.ceil(startupBytes / bytesPerPiece);
    const endPiece = Math.min(totalPieces - 1, startupPieces);

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
        timeRemaining: torrent ? torrent.timeRemaining : 0
    };
}

export async function waitForBuffer(session, minPercent = 0.02, minBytes = 1 * 1024 * 1024) {
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

export { startSession, stopSession, getSession, getMimeType, getStatus };

