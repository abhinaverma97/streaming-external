import { cookies } from "next/headers";
import { verifySession } from "./api/_lib/auth.js";
import { getWatchlist, getProgress, getHistory, getRatings, getSourcePrefs } from "./api/_lib/store.js";
import { getTrendingMovies, getTrendingTv } from "./api/_lib/tmdb.js";
import db from "./api/_lib/db.js";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const session = token ? await verifySession(token) : null;
    const userId = session?.userId;
    const username = userId ? db.prepare("SELECT username FROM users WHERE id = ?").get(userId)?.username : null;

    const [[wl, cw, hist, rt], [trendingMovies, trendingTv], prefs] = await Promise.all([
        userId ? Promise.all([getWatchlist(userId), getProgress(userId), getHistory(userId), getRatings(userId)]) : Promise.resolve([[], [], [], {}]),
        Promise.all([getTrendingMovies(), getTrendingTv()]).catch(() => [[], []]),
        userId ? getSourcePrefs(userId).catch(() => ({ enabled: [], defaultSource: "videasy" })) : Promise.resolve({ enabled: [], defaultSource: "videasy" }),
    ]);

    return (
        <HomeClient
            watchlist={wl}
            continueWatching={cw}
            history={hist}
            ratings={rt}
            trendingMovies={Array.isArray(trendingMovies) ? trendingMovies : (trendingMovies?.results || [])}
            trendingTv={Array.isArray(trendingTv) ? trendingTv : (trendingTv?.results || [])}
            defaultSource={prefs.defaultSource}
            enabledSources={prefs.enabled}
            username={username || undefined}
        />
    );
}