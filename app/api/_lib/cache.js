import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const memory = new Map();

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

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
    return entry.value;
}

function setInMemory(key, value, ttlMs) {
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
        return null;
    }
}

async function setToDisk(cacheDir, key, value) {
    await ensureDir(cacheDir);
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

export { ensureDir };
