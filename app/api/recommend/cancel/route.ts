import { NextRequest, NextResponse } from "next/server";
import { cancelGeneration } from "../../_lib/recommend.js";
import { setGenerationStatus } from "../../_lib/store.js";
import { verifySession } from "../../_lib/auth.js";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) throw new Error("Unauthorized");
    const session = await verifySession(token);
    if (!session) throw new Error("Unauthorized");

    const userId = session.userId;
    cancelGeneration(userId);
    await setGenerationStatus(userId, false);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}