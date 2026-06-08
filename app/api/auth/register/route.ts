import { NextRequest, NextResponse } from "next/server";
import { loadUsers, saveUsers, hashPassword, generateToken, migrateLegacyData } from "../../_lib/auth.js";

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();
        if (!username || username.length < 3) {
            return NextResponse.json({ error: "Username must be at least 3 characters" }, { status: 400 });
        }
        if (!password || password.length < 4) {
            return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 });
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return NextResponse.json({ error: "Username can only contain letters, numbers, and underscores" }, { status: 400 });
        }
        const users: Record<string, any> = loadUsers();
        if (users[username]) {
            return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }
        const { hash, salt } = hashPassword(password);
        const isFirstUser = Object.keys(users).length === 0;
        users[username] = { hash, salt, createdAt: Date.now() };
        saveUsers(users);
        if (isFirstUser) {
            migrateLegacyData(username);
        }
        const token = generateToken(username);
        const res = NextResponse.json({ ok: true, username }, { status: 201 });
        res.cookies.set("auth-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: "lax",
            path: "/",
            maxAge: 604800
        });
        return res;
    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Registration failed" }, { status: 500 });
    }
}
