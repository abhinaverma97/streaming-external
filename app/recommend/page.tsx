import { getWatchlist, getRatings, getSourcePrefs } from "../api/_lib/store.js";
import RecommendClient from "./RecommendClient";

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
    const [[wl, rt], prefs] = await Promise.all([
        Promise.all([getWatchlist(), getRatings()]),
        getSourcePrefs().catch(() => ({ enabled: [], defaultSource: "videasy" })),
    ]);

    return (
        <RecommendClient
            watchlist={wl}
            ratings={rt}
            defaultSource={prefs.defaultSource}
            enabledSources={prefs.enabled}
        />
    );
}
