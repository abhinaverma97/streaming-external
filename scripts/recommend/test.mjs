import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 1. Load .env ──
function loadEnv() {
    const envPath = join(__dirname, ".env");
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        process.env[key] = val;
    }
}

loadEnv();

const API_KEY = process.env.OPENROUTER_API_KEY;
if (!API_KEY) {
    console.error("❌ OPENROUTER_API_KEY not found in .env");
    process.exit(1);
}

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// ── 2. Login as rick ──
async function login() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "rick", password: "rick" }),
        redirect: "manual",
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Login failed (${res.status}): ${body}`);
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie) throw new Error("No Set-Cookie header in login response");
    const match = setCookie.match(/auth-token=([^;]+)/);
    if (!match) throw new Error("auth-token cookie not found in Set-Cookie");
    console.log("✅ Logged in as rick");
    return match[1];
}

// ── 3. Fetch ratings ──
async function fetchRatings(token) {
    const res = await fetch(`${BASE_URL}/api/ratings`, {
        headers: { Cookie: `auth-token=${token}` },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Fetch ratings failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    const entries = Object.entries(data).filter(([, v]) => v?.movieDetails);
    console.log(`✅ Fetched ${entries.length} rated items`);
    return entries;
}

// ── 4. Build prompt ──
function getDirector(details) {
    if (details.director) return details.director;
    const crew = details.credits?.crew;
    if (crew) {
        const dir = crew.find((c) => c.job === "Director");
        if (dir) return dir.name;
    }
    return "Unknown";
}

function formatRatedItems(entries) {
    return entries
        .map(([tmdbId, item], i) => {
            const d = item.movieDetails;
            const title = d.title || d.name || "Unknown";
            const year = (d.release_date || d.first_air_date || "").slice(0, 4) || "Unknown";
            const mediaType = tmdbId.startsWith("tv-") ? "TV Show" : "Movie";
            const userRating = item.rating ?? "?";
            const tmdbRating = d.vote_average ?? "N/A";
            const director = getDirector(d);
            const synopsis = d.overview || "N/A";

            return `${i + 1}. "${title}" (${year}) - ${mediaType}
   User Rating: ${userRating}/5
   TMDB Rating: ${tmdbRating}/10
   Director: ${director}
   Synopsis: ${synopsis}`;
        })
        .join("\n\n");
}

function buildPrompt(formatted) {
    return `You are a movie and TV show recommendation engine.

Analyze this user's complete set of rated content as a whole. Identify patterns in
genres, themes, directors, tone, and era preferences. Then recommend movies and TV
shows the user would likely enjoy.

USER'S RATED CONTENT (all items):

${formatted}

Based on ALL items above, return a JSON object with:

{
  "recommendedMovies": [
    { "title": "Inception", "year": 2010, "reason": "You enjoy Christopher Nolan's complex storytelling" }
  ],
  "recommendedTvShows": [
    { "title": "Better Call Saul", "year": 2015, "reason": "You enjoy Vince Gilligan's character-driven crime dramas" }
  ]
}

IMPORTANT:
- The "year" field must be the release year of the recommended title (used to look it up on TMDB)
- Recommend 5-10 items total across both categories
- Only recommend titles the user has NOT already rated
- Be specific — explain why each recommendation fits their taste`;
}

// ── 5. Call OpenRouter with reasoning ──
async function getRecommendations(prompt) {
    console.log("🤖 Calling OpenRouter...");

    // First call — ask for recommendations with reasoning enabled
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 120000);
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        signal: controller.signal,
        method: "POST",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "openai/gpt-oss-120b:free",
            messages: [{ role: "user", content: prompt }],
            reasoning: { enabled: true },
            temperature: 0.7,
        }),
    });
    clearTimeout(t);

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`OpenRouter API error (${res.status}): ${body}`);
    }
    const data = await res.json();
    const message = data.choices?.[0]?.message;
    const content = message?.content;
    if (!content) throw new Error("Empty response from OpenRouter");

    // Parse JSON from response
    let parsed;
    const tryParse = (s) => { try { return JSON.parse(s) } catch { return null } };

    parsed = tryParse(content);
    if (!parsed) {
        // Strip markdown code fences
        const cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        parsed = tryParse(cleaned);
    }
    if (!parsed) {
        // Try extracting first top-level JSON object/array
        const match = content.match(/\{[\s\S]*\}/) || content.match(/\[[\s\S]*\]/);
        if (match) parsed = tryParse(match[0]);
    }
    if (!parsed) {
        console.error("Raw OpenRouter response:\n", content);
        throw new Error("Could not parse OpenRouter response as JSON");
    }

    // Log reasoning tokens if present
    if (data.usage?.reasoning_tokens) {
        console.log(`🧠 Reasoning tokens: ${data.usage.reasoning_tokens}`);
    }
    if (message?.reasoning_details) {
        console.log(`🧠 Reasoning: ${message.reasoning_details.summary || "present"}`);
    }

    return parsed;
}

// ── 6. Main ──
async function main() {
    try {
        const token = await login();
        const entries = await fetchRatings(token);

        if (entries.length === 0) {
            console.log("ℹ️  No rated items found for user rick.");
            return;
        }

        const formatted = formatRatedItems(entries);
        const prompt = buildPrompt(formatted);
        const result = await getRecommendations(prompt);

        console.log("\n🎬 Recommendations:\n");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("❌ Error:", err.message);
        process.exit(1);
    }
}

main();
