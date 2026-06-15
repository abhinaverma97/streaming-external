import { getWatchlist, getProgress, getHistory, getRatings, getSourcePrefs } from "./api/_lib/store.js";
import { getTrendingMovies, getTrendingTv } from "./api/_lib/tmdb.js";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
    const [[wl, cw, hist, rt], [trendingMovies, trendingTv], prefs] = await Promise.all([
        Promise.all([getWatchlist(), getProgress(), getHistory(), getRatings()]),
        Promise.all([getTrendingMovies(), getTrendingTv()]).catch(() => [[], []]),
        getSourcePrefs().catch(() => ({ enabled: [], defaultSource: "videasy" })),
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
        />
    );
}
