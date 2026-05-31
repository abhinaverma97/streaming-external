import fs from "fs";
import path from "path";
import { downloadsDir, hlsDir } from "./config.js";

/** Recursively sum the size of all files under a directory. Returns bytes. */
function dirSize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    let total = 0;
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            total += dirSize(full);
        } else {
            try {
                total += fs.statSync(full).size;
            } catch {
                // ignore inaccessible files
            }
        }
    }
    return total;
}

/** List every top-level entry in the downloads directory as a movie record. */
function listMovies() {
    if (!fs.existsSync(downloadsDir)) return [];

    return fs.readdirSync(downloadsDir, { withFileTypes: true }).map((entry) => {
        const full = path.join(downloadsDir, entry.name);
        const size = entry.isDirectory() ? dirSize(full) : (() => {
            try { return fs.statSync(full).size; } catch { return 0; }
        })();
        const stat = (() => {
            try { return fs.statSync(full); } catch { return null; }
        })();
        return {
            name: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            sizeBytes: size,
            createdAt: stat ? stat.birthtimeMs : null,
        };
    });
}

/** Delete a single movie entry (file or folder) by name. Returns true on success. */
function deleteMovie(name) {
    // Sanitise: no path traversal
    if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) {
        throw new Error("Invalid movie name");
    }
    const target = path.join(downloadsDir, name);
    if (!fs.existsSync(target)) throw new Error("Not found");
    fs.rmSync(target, { recursive: true, force: true });
    return true;
}

export const MAX_STORAGE_BYTES = 20 * 1024 * 1024 * 1024; // 20GB cleanup threshold

/** Delete every movie in the downloads directory. */
function deleteAllMovies() {
    if (!fs.existsSync(downloadsDir)) return;
    try {
        fs.rmSync(downloadsDir, { recursive: true, force: true });
        fs.mkdirSync(downloadsDir, { recursive: true });
    } catch (e) {
        console.error("Storage cleanup partial failure (locked files):", e.message);
    }
}

/** Return combined size of downloads + hls dirs in bytes. */
function totalStorageUsed() {
    return dirSize(downloadsDir) + dirSize(hlsDir);
}

export { listMovies, deleteMovie, deleteAllMovies, totalStorageUsed };
