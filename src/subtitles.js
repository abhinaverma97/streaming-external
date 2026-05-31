import fetch from 'node-fetch';
import unzipper from 'unzipper';

// In-memory cache for subtitle statuses and results
// Map<imdbId, { status: 'idle'|'fetching'|'ready'|'failed', step: string, data: string, error: string }>
const subtitleCache = new Map();

export function getSubtitleStatus(imdbId) {
    if (!subtitleCache.has(imdbId)) {
        return { status: 'idle', step: 'Not started' };
    }
    const cached = subtitleCache.get(imdbId);
    return {
        status: cached.status,
        step: cached.step,
        error: cached.error
    };
}

export function startSubtitleDownload(imdbId) {
    if (subtitleCache.has(imdbId)) {
        const cached = subtitleCache.get(imdbId);
        if (cached.status === 'fetching' || cached.status === 'ready') {
            return; // Already in progress or done
        }
    }

    const state = {
        status: 'fetching',
        step: 'Initializing download...',
        data: null,
        error: null
    };
    subtitleCache.set(imdbId, state);

    // Run fetching logic asynchronously in the background
    (async () => {
        try {
            state.step = "Searching yts-subs.com...";
            const res1 = await fetch(`https://yts-subs.com/movie-imdb/${imdbId}`);
            if (res1.status === 404) {
                state.status = "failed";
                state.step = "No subtitles found on yts-subs.com";
                state.error = "No subtitles found for this movie";
                return;
            }
            if (!res1.ok) throw new Error(`Could not fetch yts-subs.com page (Status: ${res1.status})`);
            const html1 = await res1.text();
            
            state.step = "Locating English subtitles...";
            const langRegex = /<span class="sub-lang">English<\/span>.*?<a href="(\/subtitles\/[^"]+)"/s;
            const match = langRegex.exec(html1);
            if (!match) throw new Error("No English subtitle found for this movie");
            
            const subPageUrl = 'https://yts-subs.com' + match[1];
            state.step = "Fetching subtitle details...";
            const res2 = await fetch(subPageUrl);
            if (!res2.ok) throw new Error("Could not fetch subtitle details page");
            const html2 = await res2.text();
            
            const dataLinkRegex = /data-link="([^"]+)"/;
            const dataLinkMatch = dataLinkRegex.exec(html2);
            if (!dataLinkMatch) throw new Error("Could not find data-link on subtitle page");
            const zipUrl = Buffer.from(dataLinkMatch[1], 'base64').toString('utf-8');
            
            state.step = "Downloading subtitle zip package...";
            const res3 = await fetch(zipUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                    'Referer': subPageUrl
                }
            });
            if (!res3.ok) throw new Error(`Failed to download zip: ${res3.status}`);
            
            state.step = "Extracting files from zip...";
            const arrayBuffer = await res3.arrayBuffer();
            const directory = await unzipper.Open.buffer(Buffer.from(arrayBuffer));
            
            const srtFile = directory.files.find(d => d.path.endsWith('.srt'));
            if (!srtFile) throw new Error('No .srt file found in zip');

            const srtBuffer = await srtFile.buffer();
            let cleanSrt = srtBuffer.toString('utf-8');
            // Remove hidden BOM, normalize newlines, and trim whitespace
            cleanSrt = cleanSrt.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim();

            state.step = "Converting subtitles from SRT to VTT...";
            // Convert SRT timestamps to VTT format
            let vttBody = cleanSrt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
            
            state.data = "WEBVTT\n\n" + vttBody + "\n";
            state.status = 'ready';
            state.step = 'English subtitles loaded!';
        } catch (error) {
            state.status = 'failed';
            state.step = 'Failed to load subtitles';
            state.error = error.message;
            console.error(`[Subtitle] Error downloading for ${imdbId}:`, error);
        }
    })();
}

export async function getEnglishVtt(imdbId) {
    startSubtitleDownload(imdbId);
    
    const state = subtitleCache.get(imdbId);
    if (state.status === 'ready') {
        return state.data;
    }
    if (state.status === 'failed') {
        throw new Error(state.error || "Failed to download subtitle");
    }
    
    // Poll the state until ready or failed
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            const currentState = subtitleCache.get(imdbId);
            if (currentState.status === 'ready') {
                clearInterval(interval);
                resolve(currentState.data);
            } else if (currentState.status === 'failed') {
                clearInterval(interval);
                reject(new Error(currentState.error || "Failed to download subtitle"));
            }
        }, 100);
        // Timeout after 30 seconds
        setTimeout(() => {
            clearInterval(interval);
            reject(new Error("Subtitle download timed out"));
        }, 30000);
    });
}
