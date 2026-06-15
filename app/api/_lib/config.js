import path from "path";

const rootDir = process.cwd();

export const tmdbApiKey = process.env.TMDB_API_KEY || "1070730380f5fee0d87cf0382670b255";
export const tmdbCacheDir = path.join(rootDir, ".cache", "tmdb");
export const tmdbCacheTtlMs = 24 * 60 * 60 * 1000;
export const defaultAiModel = "openai/gpt-oss-120b:free";
