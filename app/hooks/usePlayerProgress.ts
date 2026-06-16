"use client";

import { useEffect, useRef } from "react";
import { KNOWN_ORIGINS, SOURCES, getSource } from "../lib/sources-config";

const DEBUG = false;

let messageHandler: ((event: MessageEvent) => void) | null = null;
let listeners: Set<{
    activeStreamRef: React.MutableRefObject<any>;
    selectedSourceRef: React.MutableRefObject<string>;
    lastProgressRef: React.MutableRefObject<number>;
    onProgressSavedRef?: React.MutableRefObject<(() => void) | undefined>;
}> = new Set();
let latestProgressPayload: any = null;
function ensureMessageHandler() {
    if (typeof window === "undefined" || messageHandler) return;

    messageHandler = (event: MessageEvent) => {
        if (!KNOWN_ORIGINS.includes(event.origin)) return;

        listeners.forEach(({ activeStreamRef, selectedSourceRef, lastProgressRef, onProgressSavedRef }) => {
            const stream = activeStreamRef.current;
            if (!stream) return;

            try {
                const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (!msg) return;

                if (msg.timestamp !== undefined && msg.duration) {
                    if (DEBUG) console.log(`[${event.origin}] Flat message: ${JSON.stringify(msg)}`);
                    const mediaId = msg.id || msg.tmdbId;
                    if (mediaId && String(mediaId) === String(stream.details?.id)) {
                        if (DEBUG) console.log(`[${event.origin}] timeupdate: ${msg.timestamp}/${msg.duration}`);
                        reportProgress(stream, selectedSourceRef.current, lastProgressRef, msg.timestamp, msg.duration, onProgressSavedRef);
                    }
                    return;
                }

                if (!msg.data) return;

                const dtype = msg.type;
                const d = msg.data;

                const sourceName = (() => { const s = SOURCES.find((x) => x.origins.includes(event.origin)); return s ? s.name : event.origin; })();
                if (DEBUG) console.log(`[${sourceName}] Event: ${dtype}${dtype === "PLAYER_EVENT" ? ` (${d.event})` : ""}`);

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
                }

                if (dtype === "MEDIA_DATA") {
                    let found = false;
                    const entries: any[] = Array.isArray(d) ? d : Object.values(d);
                    for (const entry of entries) {
                        if (entry && entry.progress && entry.id && String(entry.id) === String(stream.details?.id)) {
                            currentTime = entry.progress.watched;
                            duration = entry.progress.duration;
                            if (currentTime && duration) {
                                reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime, duration, onProgressSavedRef);
                            }
                            found = true;
                            break;
                        }
                    }
                    if (!found && d?.id && d?.progress?.watched && d?.progress?.duration && String(d.id) === String(stream.details?.id)) {
                        reportProgress(stream, selectedSourceRef.current, lastProgressRef, d.progress.watched, d.progress.duration, onProgressSavedRef);
                    }
                    return;
                }

                if (!evt || currentTime === undefined || !duration) return;
                if (mediaId === undefined) mediaId = stream.details?.id;
                if (String(mediaId) !== String(stream.details?.id)) return;

                if (evt === "timeupdate" && currentTime >= 0 && duration > 0) {
                    reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime, duration, onProgressSavedRef);
                } else if (evt === "ended") {
                    reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime || duration, duration, onProgressSavedRef);
                } else if (evt === "play" && currentTime >= 2 && duration > 0) {
                    reportProgress(stream, selectedSourceRef.current, lastProgressRef, currentTime, duration, onProgressSavedRef);
                }
            } catch {
                // ignore parse errors
            }
        });
    };

    window.addEventListener("message", messageHandler);
}

let currentProgressAbort: AbortController | null = null;
let lastReportTime = 0;
const THROTTLE_MS = 5000;

async function reportProgress(
    stream: any,
    source: string,
    lastProgressRef: React.MutableRefObject<number>,
    currentTime: number,
    duration: number,
    onProgressSavedRef?: React.MutableRefObject<(() => void) | undefined>,
    force: boolean = false
) {
    if (!stream || !duration || currentTime < 2) return;
    lastProgressRef.current = currentTime;
    latestProgressPayload = { stream, source, lastProgressRef, currentTime, duration, onProgressSavedRef };

    const now = Date.now();
    if (!force && now - lastReportTime < THROTTLE_MS) return;
    lastReportTime = now;

    try {
        const resolvedMediaType = stream.details.media_type || stream.details.mediaType || (stream.tmdbId.startsWith("tv-") ? "tv" : "movie");
        if (DEBUG) console.log(`[${getSource(source).name}] Progress: ${Math.round(currentTime)}s / ${Math.round(duration)}s (${Math.round((currentTime / duration) * 100)}%)`);
        if (currentProgressAbort) currentProgressAbort.abort();
        currentProgressAbort = new AbortController();
        const res = await fetch(`/api/progress`, {
            signal: currentProgressAbort.signal,
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
        if (res.ok) onProgressSavedRef?.current?.();
    } catch (err) {
        if (DEBUG) console.log(`[Progress] Report failed: ${err}`);
    }
}

export function flushGlobalProgress() {
    if (latestProgressPayload && latestProgressPayload.stream) {
        reportProgress(
            latestProgressPayload.stream,
            latestProgressPayload.source,
            latestProgressPayload.lastProgressRef,
            latestProgressPayload.currentTime,
            latestProgressPayload.duration,
            latestProgressPayload.onProgressSavedRef,
            true
        );
        latestProgressPayload = null;
    }
}

export function usePlayerProgress(
    activeStreamRef: React.MutableRefObject<any>,
    selectedSourceRef: React.MutableRefObject<string>,
    lastProgressRef: React.MutableRefObject<number>,
    onProgressSaved?: () => void,
) {
    const onProgressSavedRef = useRef(onProgressSaved);
    useEffect(() => { onProgressSavedRef.current = onProgressSaved; }, [onProgressSaved]);

    ensureMessageHandler();

    useEffect(() => {
        const key = { activeStreamRef, selectedSourceRef, lastProgressRef, onProgressSavedRef };
        listeners.add(key);
        return () => {
            listeners.delete(key);
            if (listeners.size === 0 && messageHandler) {
                window.removeEventListener("message", messageHandler);
                messageHandler = null;
            }
        };
    }, []); // Empty dependency array to avoid thrashing
}
