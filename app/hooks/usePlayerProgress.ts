"use client";

import { useEffect, useRef } from "react";
import { KNOWN_ORIGINS, SOURCES, getSource } from "../lib/sources-config";

const DEBUG = false;

export function usePlayerProgress(
    activeStreamRef: React.MutableRefObject<any>,
    selectedSourceRef: React.MutableRefObject<string>,
    lastProgressRef: React.MutableRefObject<number>,
) {
    const progressTimeoutRef = useRef<any>(null);

    const reportProgress = async (currentTime: number, duration: number) => {
        const stream = activeStreamRef.current;
        const source = selectedSourceRef.current;
        if (!stream || !duration || currentTime < 5) return;
        lastProgressRef.current = currentTime;

        try {
            const resolvedMediaType = stream.details.media_type || stream.details.mediaType || (stream.tmdbId.startsWith("tv-") ? "tv" : "movie");
            if (DEBUG) console.log(`[${getSource(source).name}] Progress: ${Math.round(currentTime)}s / ${Math.round(duration)}s (${Math.round((currentTime / duration) * 100)}%)`);
            await fetch(`/api/progress`, {
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
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (!KNOWN_ORIGINS.includes(event.origin)) return;

            const stream = activeStreamRef.current;
            if (!stream) return;

            try {
                const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (!msg) return;

                // Flat JSON fallback (VIDEASY legacy): { id, timestamp, duration, ... }
                if (msg.timestamp !== undefined && msg.duration) {
                    if (DEBUG) console.log(`[${event.origin === "https://player.videasy.net" ? "VIDEASY" : event.origin}] Flat message: ${JSON.stringify(msg)}`);
                    const mediaId = msg.id || msg.tmdbId;
                    if (mediaId && String(mediaId) === String(stream.details?.id)) {
                        if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
                        progressTimeoutRef.current = setTimeout(() => reportProgress(msg.timestamp, msg.duration), 500);
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
                } else if (dtype === "WATCH_PROGRESS") {
                    evt = d.eventType;
                    currentTime = d.currentTime;
                    duration = d.duration;
                    mediaId = d.mediaId;
                }

                if (dtype === "MEDIA_DATA") {
                    const entries = Array.isArray(d) ? d : Object.values(d);
                    for (const entry of entries) {
                        if (entry && entry.progress && entry.id && String(entry.id) === String(stream.details?.id)) {
                            currentTime = entry.progress.watched;
                            duration = entry.progress.duration;
                            if (currentTime && duration) {
                                reportProgress(currentTime, duration);
                            }
                            break;
                        }
                    }
                    return;
                }

                if (!evt || currentTime === undefined || !duration) return;
                if (String(mediaId) !== String(stream.details?.id)) return;

                if (evt === "timeupdate" && currentTime >= 0 && duration > 0) {
                    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
                    progressTimeoutRef.current = setTimeout(() => reportProgress(currentTime, duration), 500);
                }

                if (evt === "ended") {
                    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
                    reportProgress(currentTime || duration, duration);
                }
            } catch {
                // ignore parse errors
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);
}
