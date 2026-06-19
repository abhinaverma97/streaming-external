import { getRatings, getSourcePrefs } from "../api/_lib/store.js";
import LogClient from "./LogClient";

export const dynamic = "force-dynamic";

export default async function LogPage() {
    const [ratings, prefs] = await Promise.all([
        getRatings(),
        getSourcePrefs().catch(() => ({ enabled: [], defaultSource: "videasy" })),
    ]);

    return (
        <LogClient
            ratings={ratings}
            defaultSource={prefs.defaultSource}
            enabledSources={prefs.enabled}
        />
    );
}
