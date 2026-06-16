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
            initialTimeoutId = setTimeout(runDaemon, 5000);
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
        const { getRecommendations } = await import("./app/api/_lib/store.js");
        const cached = await getRecommendations();

        const isStale = !cached || !cached.generatedAt || (Date.now() - cached.generatedAt > 2 * 60 * 60 * 1000);

        if (isStale && !cached?.isGenerating) {
            const { getAiSettings } = await import("./app/api/_lib/store.js");
            const aiSettings = await getAiSettings();
            if (!aiSettings.apiKey) {
                console.log("[Daemon] No API key configured, skipping generation.");
                return;
            }
            if (cached?.error) {
                console.log("[Daemon] Previous error detected, clearing and retrying:", cached.error);
            }
            console.log("[Daemon] Triggering background generation");
            const { runFullGenerationPipeline } = await import("./app/api/_lib/recommend.js");
            await runFullGenerationPipeline();
        }
    } catch (e) {
        console.error("[Daemon] Error in daemon loop:", e);
    }
}
