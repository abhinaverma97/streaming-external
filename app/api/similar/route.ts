import { NextRequest, NextResponse } from "next/server";
import { searchByTitle, getPageHtml, parseSimilarItems } from "../_lib/bestsimilar";
import { searchMovies, searchTv } from "../_lib/tmdb";

const CONCURRENCY = 5;

interface SimilarItem {
    title: string;
    year: number;
    similarity: number;
}

async function enrichItem(item: SimilarItem, searchFn: (q: string) => Promise<any>, mediaType: string) {
    try {
        const data = await searchFn(item.title);
        const result = data.results?.[0];
        if (result) {
            const isTv = mediaType === "tv";
            return {
                ...item,
                id: result.id,
                title: isTv ? result.name : result.title,
                poster_path: result.poster_path,
                backdrop_path: result.backdrop_path,
                overview: result.overview,
                vote_average: result.vote_average,
                release_date: result.release_date,
                first_air_date: result.first_air_date,
                media_type: mediaType,
            };
        }
        return { ...item, id: null, media_type: mediaType };
    } catch (err) {
        console.error(`[Similar] Failed to enrich "${item.title}": ${err}`);
        return { ...item, id: null, media_type: mediaType };
    }
}

async function enrichBatch(items: SimilarItem[], searchFn: (q: string) => Promise<any>, mediaType: string) {
    const results: any[] = [];
    for (let i = 0; i < items.length; i += CONCURRENCY) {
        const batch = items.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
            batch.map((item) => enrichItem(item, searchFn, mediaType))
        );
        batchResults.forEach((r, idx) => {
            results.push(r.status === "fulfilled" ? r.value : { ...batch[idx], id: null, media_type: mediaType });
        });
    }
    return results;
}

export async function POST(req: NextRequest) {
    try {
        const { title, mediaType = "movie" } = await req.json();
        if (!title) {
            return NextResponse.json({ error: "Missing title" }, { status: 400 });
        }

        const searchResult = await searchByTitle(title, mediaType);
        if (!searchResult || !searchResult.url) {
            return NextResponse.json({ items: [], total: 0 });
        }

        const html = await getPageHtml(searchResult.url);
        if (!html) {
            return NextResponse.json({ items: [], total: 0 });
        }

        const rawItems = parseSimilarItems(html);
        if (rawItems.length === 0) {
            return NextResponse.json({ items: [], total: 0 });
        }

        const defaultSearchFn = mediaType === "tv" ? searchTv : searchMovies;
        const enriched = await enrichBatch(rawItems, defaultSearchFn, mediaType);

        return NextResponse.json({
            items: enriched,
            total: rawItems.length,
        });
    } catch (e: any) {
        console.error(`[Similar] Error: ${e.message}`);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
