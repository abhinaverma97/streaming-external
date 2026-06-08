import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "../../_lib/auth.js";
import { cancelGeneration } from "../../_lib/recommend.js";
import { setGenerationStatus } from "../../_lib/user-db.js";

function extractUsername(req: NextRequest): string | null {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(req: NextRequest) {
  try {
    const username = extractUsername(req);
    if (!username) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const cancelled = cancelGeneration(username);
    await setGenerationStatus(username, false);

    return NextResponse.json({ success: true, cancelled });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
