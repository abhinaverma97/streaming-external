let intervalId: NodeJS.Timeout | null = null;
let initialTimeoutId: NodeJS.Timeout | null = null;
let shuttingDown = false;

function stopDaemon() {
    shuttingDown = true;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    if (initialTimeoutId) {
        clearTimeout(initialTimeoutId);
        initialTimeoutId = null;
    }
}

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (!intervalId) {
            console.log("[Daemon] Starting server-side recommendation daemon");
            initialTimeoutId = setTimeout(runDaemon, 10000);
            intervalId = setInterval(runDaemon, 2 * 60 * 60 * 1000);

            process.on('SIGTERM', stopDaemon);
            process.on('SIGINT', stopDaemon);
        }
    }
}

async function runDaemon() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    if (shuttingDown) return;

    console.log("[Daemon] Running background recommendation check...");
    try {
        const dbModule = await import("./app/api/_lib/db.js");
        const db = dbModule.default;
        const { getRecommendations } = await import("./app/api/_lib/store.js");

        const users = db.prepare(`
            SELECT user_id FROM settings WHERE ai_api_key IS NOT NULL AND ai_api_key != ''
        `).all();

        for (const { user_id } of users) {
            const cached = await getRecommendations(user_id);
            const isStale = !cached || !cached.generatedAt || (Date.now() - cached.generatedAt * 1000 > 2 * 60 * 60 * 1000);

            if (isStale && !cached?.isGenerating) {
                if (cached?.error) {
                    console.log(`[Daemon] User ${user_id} error cleared, retrying:`, cached.error);
                }
                console.log(`[Daemon] Triggering generation for user ${user_id}`);
                const { runFullGenerationPipeline } = await import("./app/api/_lib/recommend.js");
                await runFullGenerationPipeline(user_id);
            }
        }
    } catch (e) {
        console.error("[Daemon] Error in daemon loop:", e);
    }
}