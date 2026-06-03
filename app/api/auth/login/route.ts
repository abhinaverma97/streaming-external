import { NextRequest, NextResponse } from "next/server";
import { loadUsers, verifyPassword, generateToken } from "../../_lib/auth.js";

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();
        if (!username || !password) {
            return NextResponse.json({ error: "Username and password required" }, { status: 400 });
        }
        const users = loadUsers();
        const user = users[username];
        if (!user || !verifyPassword(password, user.hash, user.salt)) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }
        const token = generateToken(username);
        const res = NextResponse.json({ ok: true, username }, { status: 200 });
        res.cookies.set("auth-token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 604800
        });
        return res;
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Login failed" }, { status: 500 });
    }
}
