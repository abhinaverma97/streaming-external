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
    const raw = loadUsers();
    const users = Object.entries(raw).map(([name, data]: [string, any]) => ({
        username: name,
        createdAt: data.createdAt
    }));
    users.sort((a, b) => a.createdAt - b.createdAt);
    return NextResponse.json({ users }, { status: 200 });
}
