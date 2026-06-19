import { cookies } from "next/headers";
import { verifySession } from "../api/_lib/auth.js";
import { getRatings, getSourcePrefs } from "../api/_lib/store.js";
import LogClient from "./LogClient";

export const dynamic = "force-dynamic";

export default async function LogPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const session = token ? await verifySession(token) : null;
    const userId = session?.userId;

    const [ratings, prefs] = await Promise.all([
        userId ? getRatings(userId) : Promise.resolve({}),
        userId ? getSourcePrefs(userId).catch(() => ({ enabled: [], defaultSource: "videasy" })) : Promise.resolve({ enabled: [], defaultSource: "videasy" }),
    ]);

    return (
        <LogClient
            ratings={ratings}
            defaultSource={prefs.defaultSource}
            enabledSources={prefs.enabled}
        />
    );
}