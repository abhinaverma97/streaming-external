import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verifyToken, loadUsers, saveUsers } from "../../../_lib/auth.js";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    const targetUsername = (await params).username;

    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const adminUsername = verifyToken(token);
    if (!adminUsername) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    if (adminUsername !== "abhi") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (targetUsername === "abhi") {
        return NextResponse.json({ error: "Cannot delete admin account" }, { status: 400 });
    }

    const users: Record<string, any> = loadUsers();
    if (!users[targetUsername]) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    delete users[targetUsername];
    saveUsers(users);

    const userDataDir = path.join(process.cwd(), ".cache", "users", targetUsername);
    try {
        if (fs.existsSync(userDataDir)) {
            fs.rmSync(userDataDir, { recursive: true, force: true });
        }
    } catch (e) {
        console.error(`[Admin] Failed to delete data dir for ${targetUsername}`, e);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
}
