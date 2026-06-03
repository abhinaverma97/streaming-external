import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
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
    const raw = loadUsers();
    const activeThreshold = Date.now() - 24 * 60 * 60 * 1000;

    const users = Object.entries(raw).map(([name, data]: [string, any]) => {
        const userDataPath = path.join(process.cwd(), ".cache", "users", name, "user-data.json");
        let lastActive: number | null = null;
        try {
            const stat = fs.statSync(userDataPath);
            const dataCreated = data.createdAt || 0;
            if (stat.mtimeMs > dataCreated) {
                lastActive = stat.mtimeMs;
            }
        } catch {}
        return {
            username: name,
            createdAt: data.createdAt ?? null,
            lastActive
        };
    });

    users.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const activeUsers = users.filter(u => u.lastActive && u.lastActive > activeThreshold).length;

    return NextResponse.json({ users, totalUsers: users.length, activeUsers }, { status: 200 });
}
