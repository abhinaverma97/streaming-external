"use client";

import { useState, useCallback, useEffect } from "react";
import { SOURCES } from "../lib/sources-config";

export function useSourcePrefs() {
    const [selectedSource, setSelectedSource] = useState<string>("videasy");
    const [defaultSource, setDefaultSource] = useState<string>("videasy");
    const [enabledSources, setEnabledSources] = useState<string[]>(() => {
        try {
            const raw = localStorage.getItem("spicy-enabled-sources");
            if (raw) {
                const p = JSON.parse(raw);
                if (Array.isArray(p) && p.length > 0) return p;
            }
        } catch {}
        return SOURCES.map((s) => s.id);
    });

    const effectiveEnabledSources = enabledSources.length > 0 ? enabledSources : SOURCES.map((s) => s.id);
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

    const fetchSourcePrefs = useCallback(async () => {
        try {
            const res = await fetch("/api/source-prefs");
            if (!res.ok) return;
            const data = await res.json();
            if (data.enabled && Array.isArray(data.enabled) && data.enabled.length > 0) {
                setEnabledSources(data.enabled);
                localStorage.setItem("spicy-enabled-sources", JSON.stringify(data.enabled));
            }
            if (data.defaultSource && SOURCES.some((s) => s.id === data.defaultSource)) {
                setSelectedSource(data.defaultSource);
                setDefaultSource(data.defaultSource);
            }
        } catch {}
    }, []);

    useEffect(() => {
        fetchSourcePrefs();
    }, [fetchSourcePrefs]);

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
