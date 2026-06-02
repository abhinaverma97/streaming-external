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

type RouteHandler = (req: NextRequest, segments: string[]) => Promise<NextResponse>;

function json(data: any, status = 200) {
    return NextResponse.json(data, { status });
}

function error(msg: string, status = 500) {
    return NextResponse.json({ error: msg }, { status });
}

async function handle(req: NextRequest, segments: string[]): Promise<NextResponse> {
    const method = req.method;
    const [s0, s1, s2, s3] = segments;

    try {
        // ── Health ─────────────────────────────────────────────────────
        if (s0 === "health") {
            return json({ ok: true });
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
            return json(data);
        }

        // ── Movie / TV Details ─────────────────────────────────────────
        const pageNum = (p: string | null) => p ? Number(p) : 1;

        if ((s0 === "movie" || s0 === "movies") && s1 && method === "GET") {
            if (s1 === "trending") return json(await getTrendingMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s1 === "top-rated") return json(await getTopRatedMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s1 === "genre" && s2) return json(await getMoviesByGenre(s2, pageNum(req.nextUrl.searchParams.get("page"))));
            if (s2 === "trending") return json(await getTrendingMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s2 === "top-rated") return json(await getTopRatedMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            return json({ tmdb: await movieDetails(s1) });
        }

        if (s0 === "tv" && s1 && method === "GET") {
            if (s1 === "trending") return json(await getTrendingTv(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s1 === "genre" && s2) return json(await getMoviesByGenre(s2, pageNum(req.nextUrl.searchParams.get("page"))));
            return json({ tmdb: await tvDetails(s1) });
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
            if (method === "GET") return json(getWatchlist());
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                addToWatchlist(body.tmdbId, body.movieDetails, body.mediaType);
                return json({ ok: true });
            }
            if ((method === "DELETE" || method === "POST") && s1) {
                removeFromWatchlist(s1);
                return json({ ok: true });
            }
        }

        // ── Progress ───────────────────────────────────────────────────
        if (s0 === "progress" && method === "POST") {
            const body = await req.json();
            if (!body.tmdbId || body.timestamp === undefined) return error("Missing required fields", 400);
            if (!body.duration) return error("Duration unavailable", 400);
            saveProgress(body.tmdbId, Number(body.timestamp), Number(body.duration), body.movieDetails, body.mediaType, body.source);
            return json({ ok: true });
        }

        // ── Continue Watching ──────────────────────────────────────────
        if (s0 === "continue-watching") {
            return json(getProgress());
        }

        // ── History ────────────────────────────────────────────────────
        if (s0 === "history") {
            if (method === "GET") return json(getHistory());
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                addToHistory(body.tmdbId, body.movieDetails);
                return json({ ok: true });
            }
            if ((method === "DELETE") && s1) {
                removeFromHistory(s1);
                return json({ ok: true });
            }
        }

        // ── Ratings ────────────────────────────────────────────────────
        if (s0 === "ratings") {
            if (method === "GET") return json(getRatings());
            if (method === "POST" && s1) {
                const body = await req.json();
                if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
                    return error("Invalid rating", 400);
                }
                saveRating(s1, body.rating, body.movieDetails);
                return json({ ok: true });
            }
        }

        // ── Source Preferences ─────────────────────────────────────────
        if (s0 === "source-prefs") {
            if (method === "GET") return json(getSourcePrefs());
            if (method === "POST") {
                const body = await req.json();
                if (!body.enabled || !body.defaultSource) return error("Missing enabled or defaultSource", 400);
                saveSourcePrefs(body.enabled, body.defaultSource);
                return json({ ok: true });
            }
        }

        return error("Not found", 404);
    } catch (e: any) {
        return error(e.message || "Internal error");
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    const slug = (await params).slug;
    return handle(req, slug);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    const slug = (await params).slug;
    return handle(req, slug);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    const slug = (await params).slug;
    return handle(req, slug);
}
