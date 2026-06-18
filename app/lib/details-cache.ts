// Client-side in-memory cache for /api/movie/:id and /api/tv/:id.
//
// The server already caches TMDB responses for 4 hours (mem LRU + disk).
// This cache deduplicates *client* calls so a movie/show whose details have
// already been fetched in the current session (for the hero, the player
// modal, a similar item, the recommend grid, etc.) is not re-fetched.
//
// - Coalesces concurrent callers via in-flight Promise sharing.
// - No TTL: TMDB metadata is effectively immutable for a session; the
//   server-side disk cache enforces a 4h TTL on its own.
// - Returns the same shape as the API: `details` is what was at `data.tmdb`.

type MediaType = "movie" | "tv";

interface Entry {
    value?: any;
    inflight?: Promise<any>;
}

const cache = new Map<string, Entry>();
const MAX_ENTRIES = 200;

function keyOf(id: number | string, mediaType: MediaType): string {
    return `${mediaType}:${id}`;
}

function touch(key: string, entry: Entry) {
    // LRU: re-insert to move to most-recent position.
    cache.delete(key);
    cache.set(key, entry);
    if (cache.size > MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest) cache.delete(oldest);
    }
}

export async function getDetails(
    id: number | string,
    mediaType: MediaType = "movie"
): Promise<any | null> {
    if (id === undefined || id === null || id === "") return null;
    const key = keyOf(id, mediaType);
    const existing = cache.get(key);

    if (existing?.value) {
        touch(key, existing);
        return existing.value;
    }
    if (existing?.inflight) {
        return existing.inflight;
    }

    const inflight = (async () => {
        try {
            const res = await fetch(`/api/${mediaType}/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            const details = data?.tmdb ?? data;
            if (details) {
                cache.set(key, { value: details });
                touch(key, { value: details });
            } else {
                cache.delete(key);
            }
            return details;
        } catch {
            cache.delete(key);
            return null;
        }
    })();

    cache.set(key, { inflight });
    return inflight;
}

export function getCachedDetailsSync(
    id: number | string,
    mediaType: MediaType = "movie"
): any | null {
    const e = cache.get(keyOf(id, mediaType));
    return e?.value ?? null;
}

export function primeDetails(
    id: number | string,
    mediaType: MediaType,
    details: any
) {
    if (!details) return;
    const key = keyOf(id, mediaType);
    cache.set(key, { value: details });
    touch(key, { value: details });
}

export function clearDetailsCache() {
    cache.clear();
}
