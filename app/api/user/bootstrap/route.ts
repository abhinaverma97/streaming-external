import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../_lib/auth.js";
import {
    getWatchlist, getProgress, getHistory, getRatings,
    getSourcePrefs, getAiSettings
} from "../../_lib/user-db.js";
import db from "../../_lib/db";

export async function GET(req: NextRequest) {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    
    const username = verifyToken(token);
    if (!username) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    // Update last active
    try {
        db.prepare("UPDATE users SET lastActive = ? WHERE username = ?").run(Date.now(), username);
    } catch (e) {
        console.error("Failed to update lastActive", e);
    }

    const [watchlist, continueWatching, history, ratings, sourcePrefs, aiSettings] = await Promise.all([
        getWatchlist(username),
        getProgress(username),
        getHistory(username),
        getRatings(username),
        getSourcePrefs(username),
        getAiSettings(username)
    ]);

    return NextResponse.json({
        username,
        watchlist,
        continueWatching,
        history,
        ratings,
        sourcePrefs,
        aiSettings
    });
}
