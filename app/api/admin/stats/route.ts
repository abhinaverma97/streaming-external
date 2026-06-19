import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "../../_lib/auth.js";
import db from "../../_lib/db.js";

export async function GET(req: NextRequest) {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await verifySession(token);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = db.prepare("SELECT username FROM users WHERE id = ?").get(session.userId);
    if (!user || user.username !== "abhi") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userCount = (db.prepare("SELECT COUNT(*) as count FROM users").get() as any).count;
    const ratingCount = (db.prepare("SELECT COUNT(*) as count FROM ratings").get() as any).count;
    const watchlistCount = (db.prepare("SELECT COUNT(*) as count FROM watchlist").get() as any).count;

    return NextResponse.json({
        userCount,
        ratingCount,
        watchlistCount,
    });
}