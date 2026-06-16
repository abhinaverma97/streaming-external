"use client";

import { useState, useCallback } from "react";
import { SOURCES } from "../lib/sources-config";

const ALL_SOURCES = SOURCES.map((s) => s.id);

export function useSourcePrefs(initialSource?: string, initialEnabled?: string[]) {
    const [defaultSource, setDefaultSource] = useState<string>(initialSource || "videasy");
    const [enabledSources, setEnabledSources] = useState<string[]>(() =>
        initialEnabled?.length ? initialEnabled : ALL_SOURCES
    );

    const effectiveEnabledSources = enabledSources.length > 0 ? enabledSources : ALL_SOURCES;
    const effectiveSource = effectiveEnabledSources.includes(defaultSource)
        ? defaultSource
        : (effectiveEnabledSources[0] || "videasy");

    const onSourcesChange = useCallback((enabled: string[], defaultSourceVal: string) => {
        setEnabledSources(enabled);
        setDefaultSource(defaultSourceVal);
        fetch("/api/source-prefs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled, defaultSource: defaultSourceVal })
        }).catch(() => {});
    }, []);

    return {
        defaultSource,
        enabledSources,
        effectiveEnabledSources,
        effectiveSource,
        onSourcesChange,
    };
}
