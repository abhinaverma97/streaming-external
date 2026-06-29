import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import {
    movieDetails, tvDetails,
    getTrendingMovies, getTrendingTv,
} from "../_lib/tmdb.js";
import {
    getWatchlist, addToWatchlist, removeFromWatchlist,
    getProgress, saveProgress,
    getHistory, addToHistory, removeFromHistory,
    getRatings, saveRating, deleteRating,
    getSourcePrefs, saveSourcePrefs,
    getAiSettings, saveAiSettings
} from "../_lib/store.js";
import { verifySession } from "../_lib/auth.js";

function json(data: any, status = 200) {
    return NextResponse.json(data, { status });
}

function error(msg: string, status = 500) {
    return NextResponse.json({ error: msg }, { status });
}

async function getUserId(req: NextRequest): Promise<number> {
    const token = req.cookies.get("token")?.value;
    if (!token) throw new Error("Unauthorized");
    const session = await verifySession(token);
    if (!session) throw new Error("Unauthorized");
    return session.userId;
}

async function handle(req: NextRequest, segments: string[]): Promise<NextResponse> {
    const method = req.method;
    const [s0, s1, s2] = segments;

    try {
        if (s0 === "health") return json({ ok: true });

        const pageNum = (p: string | null) => p ? Number(p) : 1;

        if ((s0 === "movie" || s0 === "movies") && s1 && method === "GET") {
            if (s1 === "trending") return json(await getTrendingMovies(pageNum(req.nextUrl.searchParams.get("page"))));
            return json({ tmdb: await movieDetails(s1) });
        }

        if (s0 === "tv" && s1 && method === "GET") {
            if (s1 === "trending") return json(await getTrendingTv(pageNum(req.nextUrl.searchParams.get("page"))));
            return json({ tmdb: await tvDetails(s1) });
        }

        if (s0 === "watchlist") {
            const userId = await getUserId(req);
            if (method === "GET") return json(await getWatchlist(userId));
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                await addToWatchlist(userId, body.tmdbId, body.movieDetails, body.mediaType);
                return json({ ok: true });
            }
            if (method === "DELETE" && s1) {
                await removeFromWatchlist(userId, s1);
                return json({ ok: true });
            }
        }

        if (s0 === "progress" && method === "POST") {
            const userId = await getUserId(req);
            const body = await req.json();
            if (!body.tmdbId || typeof body.timestamp !== "number" || isNaN(body.timestamp))
                return error("Missing or invalid required fields", 400);
            if (typeof body.duration !== "number" || isNaN(body.duration))
                return error("Duration unavailable or invalid", 400);
            await saveProgress(userId, body.tmdbId, body.timestamp, body.duration, body.movieDetails, body.mediaType, body.source);
            return json({ ok: true });
        }

        if (s0 === "continue-watching") {
            const userId = await getUserId(req);
            return json(await getProgress(userId));
        }

        if (s0 === "history") {
            const userId = await getUserId(req);
            if (method === "GET") return json(await getHistory(userId));
            if (method === "POST") {
                const body = await req.json();
                if (!body.tmdbId) return error("Missing tmdbId", 400);
                await addToHistory(userId, body.tmdbId, body.movieDetails);
                return json({ ok: true });
            }
            if (method === "DELETE" && s1) {
                await removeFromHistory(userId, s1);
                return json({ ok: true });
            }
        }

        if (s0 === "ratings") {
            const userId = await getUserId(req);
            if (method === "GET") return json(await getRatings(userId));
            if (method === "POST" && s1) {
                const body = await req.json();
                if (typeof body.rating !== "number" || isNaN(body.rating) || body.rating < 1 || body.rating > 10)
                    return error("Invalid rating", 400);
                await saveRating(userId, s1, body.rating, body.movieDetails, body.thoughts);
                return json({ ok: true });
            }
            if (method === "DELETE" && s1) {
                await deleteRating(userId, s1);
                return json({ ok: true });
            }
        }

        if (s0 === "source-prefs") {
            const userId = await getUserId(req);
            if (method === "GET") return json(await getSourcePrefs(userId));
            if (method === "POST") {
                const body = await req.json();
                if (!body.enabled || !body.defaultSource) return error("Missing enabled or defaultSource", 400);
                const { SOURCES } = await import("../../lib/sources-config");
                const validIds = SOURCES.map((s: any) => s.id);
                const isValid = body.enabled.every((id: string) => validIds.includes(id)) && validIds.includes(body.defaultSource);
                if (!isValid) return error("Invalid source ID", 400);
                await saveSourcePrefs(userId, body.enabled, body.defaultSource);
                return json({ ok: true });
            }
        }

        if (s0 === "ai-settings") {
            const userId = await getUserId(req);
            if (method === "GET") {
                const settings = await getAiSettings(userId);
                if (settings.apiKey && settings.apiKey.length > 8) {
                    settings.apiKey = settings.apiKey.slice(0, 4) + "..." + settings.apiKey.slice(-4);
                }
                return json(settings);
            }
            if (method === "POST") {
                const body = await req.json();
                await saveAiSettings(userId, { apiKey: body.apiKey, model: body.model });
                return json({ ok: true });
            }
        }

        return error("Not found", 404);
    } catch (e: any) {
        if (e.message === "Unauthorized") return error("Unauthorized", 401);
        return error(e.message || "Internal error");
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    return handle(req, (await params).slug);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    return handle(req, (await params).slug);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
    return handle(req, (await params).slug);
}