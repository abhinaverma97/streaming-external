import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
    movieDetails, tvDetails,
    getTrendingMovies, getTrendingTv, getTopRatedMovies, getMoviesByGenre, getTvByGenre
} from "../_lib/tmdb.js";
import {
    getWatchlist, addToWatchlist, removeFromWatchlist,
    getProgress, saveProgress,
    getHistory, addToHistory, removeFromHistory,
    getRatings, saveRating, deleteRating,
    getSourcePrefs, saveSourcePrefs,
    getAiSettings, saveAiSettings
} from "../_lib/store.js";
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

        // ── Movie / TV Details ─────────────────────────────────────────
        const pageNum = (p: string | null) => p ? Number(p) : 1;

        if ((s0 === "movie" || s0 === "movies") && s1 && method === "GET") {
            if (s1 === "trending") return json(await getTrendingMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s1 === "top-rated") return json(await getTopRatedMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s1 === "genre" && s2) return json(await getMoviesByGenre(s2, pageNum(req.nextUrl.searchParams.get("page"))));
            return json({ tmdb: await movieDetails(s1) });
        }

        if (s0 === "tv" && s1 && method === "GET") {
            if (s1 === "trending") return json(await getTrendingTv(pageNum(req.nextUrl.searchParams.get("page"))));
            if (s1 === "genre" && s2) return json(await getTvByGenre(s2, pageNum(req.nextUrl.searchParams.get("page"))));
            return json({ tmdb: await tvDetails(s1) });
        }

        // ── Watchlist ──────────────────────────────────────────────────
        if (s0 === "watchlist") {
            if (method === "GET") return json(await getWatchlist());
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                await addToWatchlist(body.tmdbId, body.movieDetails, body.mediaType);
                return json({ ok: true });
            }
            if (method === "DELETE" && s1) {
                await removeFromWatchlist(s1);
                return json({ ok: true });
            }
        }

        // ── Progress ───────────────────────────────────────────────────
        if (s0 === "progress" && method === "POST") {
            const body = await req.json();
            if (!body.tmdbId || body.timestamp === undefined) return error("Missing required fields", 400);
            if (!body.duration) return error("Duration unavailable", 400);
            await saveProgress(body.tmdbId, Number(body.timestamp), Number(body.duration), body.movieDetails, body.mediaType, body.source);
            return json({ ok: true });
        }

        // ── Continue Watching ──────────────────────────────────────────
        if (s0 === "continue-watching") {
            return json(await getProgress());
        }

        // ── History ────────────────────────────────────────────────────
        if (s0 === "history") {
            if (method === "GET") return json(await getHistory());
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                await addToHistory(body.tmdbId, body.movieDetails);
                return json({ ok: true });
            }
            if ((method === "DELETE") && s1) {
                await removeFromHistory(s1);
                return json({ ok: true });
            }
        }

        // ── Ratings ────────────────────────────────────────────────────
        if (s0 === "ratings") {
            if (method === "GET") return json(await getRatings());
            if (method === "POST" && s1) {
                const body = await req.json();
                if (typeof body.rating !== "number" || body.rating < 1 || body.rating > 5) {
                    return error("Invalid rating", 400);
                }
                await saveRating(s1, body.rating, body.movieDetails, body.thoughts);
                return json({ ok: true });
            }
            if (method === "DELETE" && s1) {
                await deleteRating(s1);
                return json({ ok: true });
            }
        }

        // ── Source Preferences ─────────────────────────────────────────
        if (s0 === "source-prefs") {
            if (method === "GET") return json(await getSourcePrefs());
            if (method === "POST") {
                const body = await req.json();
                if (!body.enabled || !body.defaultSource) return error("Missing enabled or defaultSource", 400);
                await saveSourcePrefs(body.enabled, body.defaultSource);
                return json({ ok: true });
            }
        }

        // ── AI Settings ────────────────────────────────────────────────
        if (s0 === "ai-settings") {
            if (method === "GET") return json(await getAiSettings());
            if (method === "POST") {
                const body = await req.json();
                await saveAiSettings({ apiKey: body.apiKey, model: body.model });
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
