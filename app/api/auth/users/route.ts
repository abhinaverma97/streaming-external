import { NextRequest, NextResponse } from "next/server";
import { verifyToken, loadUsers } from "../../_lib/auth.js";

export async function GET(req: NextRequest) {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const username = verifyToken(token);
    if (!username) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (username !== "abhi") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const raw: Record<string, any> = loadUsers();
    const activeThreshold = Date.now() - 24 * 60 * 60 * 1000;

    const users = Object.entries(raw).map(([name, data]: [string, any]) => {
        return {
            username: name,
            createdAt: data.createdAt ?? null,
            lastActive: data.lastActive ?? null
        };
    });

    users.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const activeUsers = users.filter(u => u.lastActive && u.lastActive > activeThreshold).length;

    return NextResponse.json({ users, totalUsers: users.length, activeUsers }, { status: 200 });
}
