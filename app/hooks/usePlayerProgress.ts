"use client";

import { useEffect, useRef } from "react";
import { KNOWN_ORIGINS, SOURCES, getSource } from "../lib/sources-config";

const DEBUG = false;

let messageHandler: ((event: MessageEvent) => void) | null = null;
let listeners: Set<{
    activeStreamRef: React.MutableRefObject<any>;
    selectedSourceRef: React.MutableRefObject<string>;
    lastProgressRef: React.MutableRefObject<number>;
    onProgressSaved?: () => void;
}> = new Set();
let progressTimeouts: Map<any, NodeJS.Timeout> = new Map();

function extractNumericId(prefixedId: string): string {
    const match = prefixedId.match(/\d+$/);
    return match ? match[0] : prefixedId;
}

function ensureMessageHandler() {
    if (typeof window === "undefined" || messageHandler) return;

    messageHandler = (event: MessageEvent) => {
        if (!KNOWN_ORIGINS.includes(event.origin)) return;

        listeners.forEach(({ activeStreamRef, selectedSourceRef, lastProgressRef, onProgressSaved }) => {
            const stream = activeStreamRef.current;
            if (!stream) return;

            try {
                const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (!msg) return;

                if (msg.timestamp !== undefined && msg.duration) {
                    const isVideasy = event.origin === "https://player.videasy.net" || event.origin === "https://player.videasy.to";
                    if (DEBUG) console.log(`[${isVideasy ? "VIDEASY" : event.origin}] Flat message: ${JSON.stringify(msg)}`);
                    const mediaId = msg.id || msg.tmdbId;
                    if (mediaId && String(mediaId) === String(stream.details?.id)) {
                        if (DEBUG) console.log(`[${event.origin}] timeupdate: ${msg.timestamp}/${msg.duration}`);
                        reportProgress(stream, selectedSourceRef.current, lastProgressRef, msg.timestamp, msg.duration, onProgressSaved);
                    }
                    return;
                }

                if (!msg.data) return;

                const dtype = msg.type;
                const d = msg.data;

                const sourceName = (() => { const s = SOURCES.find((x) => x.origins.includes(event.origin)); return s ? s.name : event.origin; })();
                if (DEBUG) console.log(`[${sourceName}] Event: ${dtype}${dtype === "PLAYER_EVENT" || dtype === "WATCH_PROGRESS" ? ` (${d.event || d.eventType})` : ""}`);

                let evt: string | undefined;
                let currentTime: number | undefined;
                let duration: number | undefined;
                let mediaId: number | string | undefined;

                if (dtype === "PLAYER_EVENT") {
                    evt = d.event;
                    currentTime = d.currentTime;
                    duration = d.duration;
                    mediaId = d.tmdbId ?? d.mtmdbId ?? d.id;
                    if (mediaId === undefined) {
                        mediaId = stream.details?.id;
                    }
                } else if (dtype === "WATCH_PROGRESS") {
                    evt = d.eventType || "timeupdate";
                    currentTime = d.currentTime;
                    duration = d.duration;
                    mediaId = d.mediaId;
                    if (mediaId && typeof mediaId === "string" && /^\D/.test(mediaId)) {
                        mediaId = extractNumericId(mediaId);
                    }
                    if (mediaId === undefined) {
                        mediaId = stream.details?.id;
                    }
                }

                if (dtype === "MEDIA_DATA") {
                    let found = false;
                    const entries: any[] = Array.isArray(d) ? d : Object.values(d);
                    for (const entry of entries) {
                        if (entry && entry.progress && entry.id && String(entry.id) === String(stream.details?.id)) {
                            currentTime = entry.progress.watched;
                            duration = entry.progress.duration;
                            if (currentTime && duration) {
                                reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime, duration, onProgressSaved);
                            }
                            found = true;
                            break;
                        }
                    }
                    if (!found && d?.id && d?.progress?.watched && d?.progress?.duration && String(d.id) === String(stream.details?.id)) {
                        reportProgress(stream, selectedSourceRef.current, lastProgressRef, d.progress.watched, d.progress.duration, onProgressSaved);
                    }
                    return;
                }

                if (!evt || currentTime === undefined || !duration) return;
                if (mediaId === undefined) mediaId = stream.details?.id;
                if (String(mediaId) !== String(stream.details?.id)) return;

                if (evt === "timeupdate" && currentTime >= 0 && duration > 0) {
                    reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime, duration, onProgressSaved);
                } else if (evt === "ended") {
                    reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime || duration, duration, onProgressSaved);
                } else if (evt === "play" && currentTime >= 5 && duration > 0) {
                    reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime, duration, onProgressSaved);
                }
            } catch {
                // ignore parse errors
            }
        });
    };

    window.addEventListener("message", messageHandler);
}

async function reportProgress(
    stream: any,
    source: string,
    lastProgressRef: React.MutableRefObject<number>,
    currentTime: number,
    duration: number,
    onProgressSaved?: () => void
) {
    if (!stream || !duration || currentTime < 5) return;
    lastProgressRef.current = currentTime;

    try {
        const resolvedMediaType = stream.details.media_type || stream.details.mediaType || (stream.tmdbId.startsWith("tv-") ? "tv" : "movie");
        if (DEBUG) console.log(`[${getSource(source).name}] Progress: ${Math.round(currentTime)}s / ${Math.round(duration)}s (${Math.round((currentTime / duration) * 100)}%)`);
        const res = await fetch(`/api/progress`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tmdbId: stream.tmdbId,
                mediaType: resolvedMediaType,
                timestamp: currentTime,
                duration,
                source,
                movieDetails: {
                    id: stream.details.id,
                    title: stream.details.title || stream.details.name || "Untitled",
                    poster_path: stream.details.poster_path,
                    backdrop_path: stream.details.backdrop_path,
                    vote_average: stream.details.vote_average,
                    release_date: stream.details.release_date,
                    media_type: resolvedMediaType
                }
            })
        });
        if (res.ok) onProgressSaved?.();
    } catch {
        // ignore
    }
}

export function usePlayerProgress(
    activeStreamRef: React.MutableRefObject<any>,
    selectedSourceRef: React.MutableRefObject<string>,
    lastProgressRef: React.MutableRefObject<number>,
    onProgressSaved?: () => void,
) {
    ensureMessageHandler();

    const listenerKeyRef = useRef({ activeStreamRef, selectedSourceRef, lastProgressRef, onProgressSaved });

    useEffect(() => {
        listenerKeyRef.current = { activeStreamRef, selectedSourceRef, lastProgressRef, onProgressSaved };
    });

    useEffect(() => {
        const key = { activeStreamRef, selectedSourceRef, lastProgressRef, onProgressSaved };
        listeners.add(key);
        return () => {
            listeners.delete(key);
        };
    }, []);
}
