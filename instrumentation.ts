let intervalId: NodeJS.Timeout | null = null;

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        if (!intervalId) {
            console.log("[Daemon] Starting server-side recommendation daemon");
            setTimeout(runDaemon, 5000);
            intervalId = setInterval(runDaemon, 30 * 60 * 1000);
        }
    }
}

async function runDaemon() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    
    console.log("[Daemon] Running background recommendation check...");
    try {
        const { getAllUsers, getRecommendations } = await import("./app/api/_lib/user-db.js");
        const users = await getAllUsers();
        for (const username of users) {
            const cached = await getRecommendations(username);
            
            // Check if stale (2 hours)
            const isStale = !cached || !cached.generatedAt || (Date.now() - cached.generatedAt > 2 * 60 * 60 * 1000);
            
            if (isStale && !cached?.isGenerating && !cached?.error) {
                console.log(`[Daemon] Triggering background generation for ${username}`);
                await generateAndSaveAsync(username);
            }
        }
    } catch (e) {
        console.error("[Daemon] Error in daemon loop:", e);
    }
}

async function generateAndSaveAsync(username: string) {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    try {
        const { setGenerationStatus, setGenerationError, getRatings, getWatchlist, getAiSettings, saveRecommendations } = await import("./app/api/_lib/user-db.js");
        const { generateRecommendations, enrichWithTmdb } = await import("./app/api/_lib/recommend.js");

        await setGenerationStatus(username, true);
        const ratings = await getRatings(username);
        const watchlist = await getWatchlist(username);
        const aiSettings = await getAiSettings(username);
        
        const raw = await generateRecommendations(username, ratings, watchlist, aiSettings);
        const enriched = await enrichWithTmdb(raw);
        await saveRecommendations(username, enriched);
    } catch (err: any) {
        console.error(`[Daemon] Error generating for ${username}:`, err);
        const { setGenerationStatus, setGenerationError } = await import("./app/api/_lib/user-db.js");
        if (err.message === "User cancelled generation") {
            await setGenerationStatus(username, false);
        } else {
            await setGenerationError(username, err.message || "Failed to generate recommendations.");
        }
    }
}
