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
            intervalId = setInterval(runDaemon, 30 * 60 * 1000);

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
            if (cached?.error) {
                console.log("[Daemon] Previous error detected, clearing and retrying:", cached.error);
                const { setGenerationStatus } = await import("./app/api/_lib/store.js");
                await setGenerationStatus(false);
            }
            console.log("[Daemon] Triggering background generation");
            await generateAndSaveAsync();
        }
    } catch (e) {
        console.error("[Daemon] Error in daemon loop:", e);
    }
}

async function generateAndSaveAsync() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    try {
        const { setGenerationStatus, setGenerationError, getRatings, getWatchlist, getAiSettings, saveRecommendations } = await import("./app/api/_lib/store.js");
        const { generateRecommendations, enrichWithTmdb } = await import("./app/api/_lib/recommend.js");

        await setGenerationStatus(true);
        const ratings = await getRatings();
        const watchlist = await getWatchlist();
        const aiSettings = await getAiSettings();

        const raw = await generateRecommendations(ratings, watchlist, aiSettings);
        const enriched = await enrichWithTmdb(raw);
        await saveRecommendations(enriched);
    } catch (err: any) {
        console.error("[Daemon] Error generating:", err);
        const { setGenerationStatus, setGenerationError } = await import("./app/api/_lib/store.js");
        if (err.message === "User cancelled generation") {
            await setGenerationStatus(false);
        } else {
            await setGenerationError(err.message || "Failed to generate recommendations.");
        }
    }
}
