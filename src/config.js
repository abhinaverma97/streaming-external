import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

export const port = Number(process.env.PORT || 3000);
export const tmdbApiKey = process.env.TMDB_API_KEY || "1070730380f5fee0d87cf0382670b255";
export const cacheDir = path.join(rootDir, ".cache");
export const tmdbCacheDir = path.join(rootDir, ".cache", "tmdb");
export const downloadsDir = path.join(rootDir, ".cache", "downloads");
export const hlsDir = path.join(rootDir, ".cache", "hls");
export const tmdbCacheTtlMs = 24 * 60 * 60 * 1000;
export const dailyCleanupMs = 24 * 60 * 60 * 1000;
export const hlsEnabled = process.env.HLS_ENABLED !== "false";
export const hlsTranscode = process.env.HLS_TRANSCODE === "true";
export const trackers = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://tracker.dler.org:6969/announce",
    "udp://open.stealth.si:80/announce",
    "udp://open.demonii.com:1337/announce",
    "https://tracker.moeblog.cn:443/announce",
    "udp://open.dstud.io:6969/announce",
    "udp://tracker.srv00.com:6969/announce",
    "https://tracker.zhuqiy.com:443/announce",
    "https://tracker.pmman.tech:443/announce",
    "udp://tracker.openbittorrent.com:80",
    "udp://tracker.coppersurfer.tk:6969",
    "udp://glotorrents.pw:6969/announce",
    "udp://tracker.internetwarriors.net:1337/announce",
    "udp://tracker.leechers-paradise.org:6969/announce"
];
