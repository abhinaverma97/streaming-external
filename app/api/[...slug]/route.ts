import { NextRequest, NextResponse } from "next/server";
import {
    searchMovies, searchTv, searchMulti, movieDetails, tvDetails,
    getTrendingMovies, getTrendingTv, getTopRatedMovies, getMoviesByGenre
} from "../_lib/tmdb.js";
import {
    getWatchlist, addToWatchlist, removeFromWatchlist,
    getProgress, saveProgress,
    getHistory, addToHistory, removeFromHistory,
    getRatings, saveRating,
    getSourcePrefs, saveSourcePrefs
} from "../_lib/user-db.js";
import { getSourceUrl } from "../_lib/sources.js";
import { verifyToken } from "../_lib/auth.js";

type RouteHandler = (req: NextRequest, segments: string[], username: string | null) => Promise<NextResponse>;

function json(data: any, status = 200) {
    return NextResponse.json(data, { status });
}

function cachedJson(data: any, ttlSeconds: number) {
    return NextResponse.json(data, {
        status: 200,
        headers: {
            "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${Math.floor(ttlSeconds / 2)}`
        }
    });
}

function error(msg: string, status = 500) {
    return NextResponse.json({ error: msg }, { status });
}

async function handle(req: NextRequest, segments: string[], username: string | null): Promise<NextResponse> {
    const method = req.method;
    const [s0, s1, s2, s3] = segments;

    try {
        // ── Health ─────────────────────────────────────────────────────
        if (s0 === "health") {
            return json({ ok: true });
        }

        // ── Combined User Lists ────────────────────────────────────────
        if (s0 === "user-lists" && method === "GET") {
            if (!username) return error("Not authenticated", 401);
            return json({
                watchlist: getWatchlist(username),
                continueWatching: getProgress(username),
                history: getHistory(username),
                ratings: getRatings(username),
            });
        }

        // ── Everything else requires authentication ────────────────────
        if (!username) {
            return error("Not authenticated", 401);
        }

        // ── Search ─────────────────────────────────────────────────────
        if (s0 === "search") {
            const query = req.nextUrl.searchParams.get("q");
            if (!query) return error("Missing q", 400);
            const page = Number(req.nextUrl.searchParams.get("page") || 1);
            const type = req.nextUrl.searchParams.get("type") || "movie";
            let data;
            if (type === "tv") data = await searchTv(query, page);
            else if (type === "multi") data = await searchMulti(query, page);
            else data = await searchMovies(query, page);
            return NextResponse.json(data, {
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });
        }

        // ── Movie / TV Details ─────────────────────────────────────────
        const pageNum = (p: string | null) => p ? Number(p) : 1;

        if ((s0 === "movie" || s0 === "movies") && s1 && method === "GET") {
            if (s1 === "trending") return cachedJson(await getTrendingMovies(pageNum(req.nextUrl.searchParams.get("page"))), 3600);
            if (s1 === "top-rated") return cachedJson(await getTopRatedMovies(pageNum(req.nextUrl.searchParams.get("page"))), 86400);
            if (s1 === "genre" && s2) return cachedJson(await getMoviesByGenre(s2, pageNum(req.nextUrl.searchParams.get("page"))), 86400);
            if (s2 === "trending") return cachedJson(await getTrendingMovies(pageNum(req.nextUrl.searchParams.get("page"))), 3600);
            if (s2 === "top-rated") return cachedJson(await getTopRatedMovies(pageNum(req.nextUrl.searchParams.get("page"))), 86400);
            return cachedJson({ tmdb: await movieDetails(s1) }, 86400);
        }

        if (s0 === "tv" && s1 && method === "GET") {
            if (s1 === "trending") return cachedJson(await getTrendingTv(pageNum(req.nextUrl.searchParams.get("page"))), 3600);
            if (s1 === "genre" && s2) return cachedJson(await getMoviesByGenre(s2, pageNum(req.nextUrl.searchParams.get("page"))), 86400);
            return cachedJson({ tmdb: await tvDetails(s1) }, 86400);
        }

        // ── Sources ────────────────────────────────────────────────────
        if (s0 === "sources") {
            const tmdbId = req.nextUrl.searchParams.get("tmdbId");
            if (!tmdbId) return error("Missing tmdbId", 400);
            const mediaType = req.nextUrl.searchParams.get("mediaType") || "movie";
            const season = req.nextUrl.searchParams.get("season");
            const episode = req.nextUrl.searchParams.get("episode");
            const url = getSourceUrl(
                tmdbId,
                mediaType,
                season ? Number(season) : undefined,
                episode ? Number(episode) : undefined
            );
            return json({ url });
        }

        // ── Watchlist ──────────────────────────────────────────────────
        if (s0 === "watchlist") {
            if (method === "GET") return json(await getWatchlist(username));
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                await addToWatchlist(username, body.tmdbId, body.movieDetails, body.mediaType);
                return json({ ok: true });
            }
            if ((method === "DELETE" || method === "POST") && s1) {
                await removeFromWatchlist(username, s1);
                return json({ ok: true });
            }
        }

        // ── Progress ───────────────────────────────────────────────────
        if (s0 === "progress" && method === "POST") {
            const body = await req.json();
            if (!body.tmdbId || body.timestamp === undefined) return error("Missing required fields", 400);
            if (!body.duration) return error("Duration unavailable", 400);
            await saveProgress(username, body.tmdbId, Number(body.timestamp), Number(body.duration), body.movieDetails, body.mediaType, body.source);
            return json({ ok: true });
        }

        // ── Continue Watching ──────────────────────────────────────────
        if (s0 === "continue-watching") {
            return json(await getProgress(username));
        }

        // ── History ────────────────────────────────────────────────────
        if (s0 === "history") {
            if (method === "GET") return json(await getHistory(username));
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                await addToHistory(username, body.tmdbId, body.movieDetails);
                return json({ ok: true });
            }
            if ((method === "DELETE") && s1) {
                await removeFromHistory(username, s1);
                return json({ ok: true });
            }
        }

        // ── Ratings ────────────────────────────────────────────────────
        if (s0 === "ratings") {
            if (method === "GET") return json(await getRatings(username));
            if (method === "POST" && s1) {
                const body = await req.json();
                if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
                    return error("Invalid rating", 400);
                }
                await saveRating(username, s1, body.rating, body.movieDetails);
                return json({ ok: true });
            }
        }

        // ── Source Preferences ─────────────────────────────────────────
        if (s0 === "source-prefs") {
            if (method === "GET") return json(await getSourcePrefs(username));
            if (method === "POST") {
                const body = await req.json();
                if (!body.enabled || !body.defaultSource) return error("Missing enabled or defaultSource", 400);
                await saveSourcePrefs(username, body.enabled, body.defaultSource);
                return json({ ok: true });
            }
        }

        return error("Not found", 404);
    } catch (e: any) {
        return error(e.message || "Internal error");
    }
}

function extractUsername(req: NextRequest): string | null {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return null;
    return verifyToken(token);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    const slug = (await params).slug;
    const username = extractUsername(req);
    return handle(req, slug, username);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    const slug = (await params).slug;
    const username = extractUsername(req);
    return handle(req, slug, username);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    const slug = (await params).slug;
    const username = extractUsername(req);
    return handle(req, slug, username);
}
