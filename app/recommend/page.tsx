import { cookies } from "next/headers";
import { verifySession } from "../api/_lib/auth.js";
import { getWatchlist, getRatings, getSourcePrefs } from "../api/_lib/store.js";
import RecommendClient from "./RecommendClient";

export const dynamic = "force-dynamic";

export default async function RecommendPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const session = token ? await verifySession(token) : null;
    const userId = session?.userId;

    const [[wl, rt], prefs] = await Promise.all([
        userId ? Promise.all([getWatchlist(userId), getRatings(userId)]) : Promise.resolve([[], {}]),
        userId ? getSourcePrefs(userId).catch(() => ({ enabled: [], defaultSource: "videasy" })) : Promise.resolve({ enabled: [], defaultSource: "videasy" }),
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