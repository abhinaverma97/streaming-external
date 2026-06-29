import { NextRequest, NextResponse } from "next/server";
import { getRecommendations } from "../_lib/store.js";
import { runFullGenerationPipeline } from "../_lib/recommend.js";
import { verifySession } from "../_lib/auth.js";

async function getUserId(req: NextRequest): Promise<number> {
    const token = req.cookies.get("token")?.value;
    if (!token) throw new Error("Unauthorized");
    const session = await verifySession(token);
    if (!session) throw new Error("Unauthorized");
    return session.userId;
}

export async function GET(req: NextRequest) {
    try {
        const userId = await getUserId(req);
        const cached = await getRecommendations(userId);

        if (cached?.isGenerating) {
            return NextResponse.json(cached);
        }

        if (!cached || (isStale(cached) && !cached.error)) {
            startBackgroundGeneration(userId);
            return NextResponse.json({ ...cached, isGenerating: true });
        }

        return NextResponse.json(cached);
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await getUserId(req);
        startBackgroundGeneration(userId);
        return NextResponse.json({ isGenerating: true }, { status: 202 });
    } catch (e: any) {
        if (e.message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}

function startBackgroundGeneration(userId: number) {
    runFullGenerationPipeline(userId).catch((err) => {
        console.error("[Recommend] Background generation error:", err);
    });
}

function isStale(recs: any): boolean {
    if (!recs.generatedAt) return true;
    const oneDay = 24 * 60 * 60 * 1000;
    return Date.now() - recs.generatedAt * 1000 > oneDay;
}