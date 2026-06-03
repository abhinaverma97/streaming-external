import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../_lib/auth.js";

export async function GET(req: NextRequest) {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const username = verifyToken(token);
    if (!username) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    return NextResponse.json({ username }, { status: 200 });
}
