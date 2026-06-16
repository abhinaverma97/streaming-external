import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const memory = new Map();
const LRU_MAX = 1000;

function hashKey(key) {
    return crypto.createHash("sha1").update(key).digest("hex");
}

function getCachePath(cacheDir, key) {
    return path.join(cacheDir, `${hashKey(key)}.json`);
}

function getFromMemory(key) {
    const entry = memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
        memory.delete(key);
        return null;
    }
    // LRU: Move to end of insertion order
    memory.delete(key);
    memory.set(key, entry);
    return entry.value;
}

function setInMemory(key, value, ttlMs) {
    if (memory.size >= LRU_MAX) {
        const oldest = memory.keys().next().value;
        if (oldest) memory.delete(oldest);
    }
    memory.set(key, {
        value,
        expiresAt: ttlMs ? Date.now() + ttlMs : null
    });
}

async function getFromDisk(cacheDir, key, ttlMs) {
    const cachePath = getCachePath(cacheDir, key);
    try {
        await fs.access(cachePath);
    } catch {
        return null;
    }
    try {
        const raw = await fs.readFile(cachePath, "utf8");
        const data = JSON.parse(raw);
        if (ttlMs && Date.now() - data.savedAt > ttlMs) {
            await fs.unlink(cachePath);
            return null;
        }
        return data.value;
    } catch {
        try { await fs.unlink(cachePath); } catch {}
        return null;
    }
}

async function setToDisk(cacheDir, key, value) {
    try { await fs.mkdir(cacheDir, { recursive: true }); } catch {}
    const cachePath = getCachePath(cacheDir, key);
    const payload = {
        savedAt: Date.now(),
        value
    };
    await fs.writeFile(cachePath, JSON.stringify(payload));
}

export async function getCached(cacheDir, key, ttlMs) {
    const memValue = getFromMemory(key);
    if (memValue) return memValue;
    const diskValue = await getFromDisk(cacheDir, key, ttlMs);
    if (diskValue) {
        setInMemory(key, diskValue, ttlMs);
    }
    return diskValue;
}

export async function setCached(cacheDir, key, value, ttlMs) {
    setInMemory(key, value, ttlMs);
    await setToDisk(cacheDir, key, value);
}
