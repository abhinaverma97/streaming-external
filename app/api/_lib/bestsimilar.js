const SEARCH_URL = "https://bestsimilar.com/movies/autocomplete";
const BASE_URL = "https://bestsimilar.com";

export async function searchByTitle(title, mediaType = "movie") {
    const serial = mediaType === "tv" ? 1 : 0;
    const url = `${SEARCH_URL}?serial=${serial}&term=${encodeURIComponent(title)}`;
    const res = await fetch(url, {
        headers: {
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const items = Array.isArray(data) ? data : (data.value || []);
    return items[0] || null;
}

export async function getPageHtml(url) {
    const fullUrl = `${BASE_URL}${url}`;
    const res = await fetch(fullUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });
    if (!res.ok) return "";
    return res.text();
}

export function parseSimilarItems(html) {
    const items = [];
    const itemRegex = /<div\s+class="item\s+item-small\s+item-movie\s+clearfix"[^>]*data-id="(\d+)"[^>]*>/g;
    const nameRegex = /<a\s+class="name"[^>]*>([^<]+)<\/a>/;
    const simRegex = /<span[^>]*class="smt-value"[^>]*>(\d+)%<\/span>/;

    let lastIndex = 0;
    const sections = [];
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
        const start = match.index;
        if (sections.length > 0) {
            sections[sections.length - 1].end = start;
        }
        sections.push({ id: match[1], start, end: html.length });
        lastIndex = start;
    }

    for (const section of sections) {
        const content = html.slice(section.start, section.end);

        const nameMatch = nameRegex.exec(content);
        if (!nameMatch) continue;

        const titleYear = nameMatch[1];
        const tyMatch = titleYear.match(/^(.+?)\s*\((\d{4})\)$/);
        if (!tyMatch) continue;

        const simMatch = simRegex.exec(content);

        items.push({
            title: tyMatch[1].trim(),
            year: parseInt(tyMatch[2], 10),
            similarity: simMatch ? parseInt(simMatch[1], 10) : 0,
        });
    }

    return items;
}
