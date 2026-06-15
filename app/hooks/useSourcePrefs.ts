"use client";

import { useState, useCallback, useEffect } from "react";
import { SOURCES } from "../lib/sources-config";

const ALL_SOURCES = SOURCES.map((s) => s.id);

export function useSourcePrefs(initialSource?: string, initialEnabled?: string[]) {
    const [selectedSource, setSelectedSource] = useState<string>(initialSource || "videasy");
    const [defaultSource, setDefaultSource] = useState<string>(initialSource || "videasy");
    const [enabledSources, setEnabledSources] = useState<string[]>(() =>
        initialEnabled?.length ? initialEnabled : ALL_SOURCES
    );

    useEffect(() => {
        if (initialEnabled?.length) return;
        try {
            const raw = localStorage.getItem("spicy-enabled-sources");
            if (raw) {
                const p = JSON.parse(raw);
                if (Array.isArray(p) && p.length > 0) {
                    setEnabledSources(p);
                }
            }
        } catch { /* localStorage unavailable */ }
    }, [initialEnabled]);

    const effectiveEnabledSources = enabledSources.length > 0 ? enabledSources : ALL_SOURCES;
    const effectiveSource = effectiveEnabledSources.includes(selectedSource) ? selectedSource : (effectiveEnabledSources[0] || "videasy");

    const onSourcesChange = useCallback((enabled: string[], defaultSourceVal: string) => {
        setEnabledSources(enabled);
        setDefaultSource(defaultSourceVal);
        setSelectedSource((prev) => {
            if (enabled.includes(prev)) return prev;
            return defaultSourceVal;
        });
        localStorage.setItem("spicy-enabled-sources", JSON.stringify(enabled));
        fetch("/api/source-prefs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled, defaultSource: defaultSourceVal })
        }).catch(() => {});
    }, []);

    return {
        selectedSource,
        setSelectedSource,
        defaultSource,
        enabledSources,
        effectiveEnabledSources,
        effectiveSource,
        onSourcesChange,
    };
}
