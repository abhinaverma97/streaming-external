import fs from "fs";
import path from "path";
import crypto from "crypto";

const memory = new Map();

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
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

function getFromDisk(cacheDir, key, ttlMs) {
    const cachePath = getCachePath(cacheDir, key);
    if (!fs.existsSync(cachePath)) return null;
    try {
        const raw = fs.readFileSync(cachePath, "utf8");
        const data = JSON.parse(raw);
        if (ttlMs && Date.now() - data.savedAt > ttlMs) {
            fs.unlinkSync(cachePath);
            return null;
        }
        return data.value;
    } catch {
        return null;
    }
}

function setToDisk(cacheDir, key, value) {
    ensureDir(cacheDir);
    const cachePath = getCachePath(cacheDir, key);
    const payload = {
        savedAt: Date.now(),
        value
    };
    fs.writeFileSync(cachePath, JSON.stringify(payload));
}

function getCached(cacheDir, key, ttlMs) {
    const memValue = getFromMemory(key);
    if (memValue) return memValue;
    const diskValue = getFromDisk(cacheDir, key, ttlMs);
    if (diskValue) {
        setInMemory(key, diskValue, ttlMs);
    }
    return diskValue;
}

function setCached(cacheDir, key, value, ttlMs) {
    setInMemory(key, value, ttlMs);
    setToDisk(cacheDir, key, value);
}

export { ensureDir, getCached, setCached };
