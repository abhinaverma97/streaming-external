"use client";

import { memo } from "react";
import ScrollRow from "./ScrollRow";
import FadeContent from "./FadeContent";
import { MovieCard } from "./MovieCard";
import { getSource } from "../lib/sources-config";

interface ContinueWatchingSectionProps {
    continueWatching: any[];
    effectiveEnabledSources: string[];
    effectiveSource: string;
    onResume: (item: any, src: string, parsedMovieId: number, fs: number, fe: number, mt: string) => void;
    DEBUG?: boolean;
}

function ContinueWatchingSectionInner({ continueWatching, effectiveEnabledSources, effectiveSource, onResume, DEBUG }: ContinueWatchingSectionProps) {
    if (continueWatching.length === 0) return null;

    return (
        <FadeContent className="snap-start snap-always scroll-mt-0 pt-8 pb-10">
            <h3 className="text-[10px] font-semibold mb-5 tracking-[0.28em] uppercase text-slate-300">
                Continue Watching
            </h3>
            <ScrollRow>
                {continueWatching.map((item: any) => {
                    const percent = Math.min(100, Math.round((item.timestamp / item.duration) * 100));
                    let label: React.ReactNode = null;
                    if (item.tmdbId?.startsWith("tv-")) {
                        const parts = item.tmdbId.split("-");
                        if (parts.length >= 4) {
                            const s = String(parts[2]).padStart(2, "0");
                            const e = String(parts[3]).padStart(2, "0");
                            label = <span className="text-[9px] text-slate-500 tracking-wider">S{s} E{e}</span>;
                        }
                    }

                    const handleClick = () => {
                        const mt = item.mediaType || item.movieDetails?.media_type || "movie";
                        let src = item.source;
                        if (src && !effectiveEnabledSources.includes(src)) {
                            if (DEBUG) console.log(`[Continue Watching] Saved source ${getSource(src).name} is disabled, falling back to default`);
                            src = effectiveSource;
                        }
                        if (src) { if (DEBUG) console.log(`[Continue Watching] Resuming with source: ${getSource(src).name}`); }

                        let parsedMovieId = item.movieDetails?.id;
                        let fs: number | undefined;
                        let fe: number | undefined;
                        if (item.tmdbId?.startsWith("tv-")) {
                            const parts = item.tmdbId.split("-");
                            if (parts.length >= 2) {
                                const maybeId = parseInt(parts[1], 10);
                                if (!isNaN(maybeId)) parsedMovieId = maybeId;
                            }
                            if (parts.length >= 4) {
                                fs = parseInt(parts[2], 10);
                                fe = parseInt(parts[3], 10);
                            }
                        }
                        if (!fs || isNaN(fs)) fs = 1;
                        if (!fe || isNaN(fe)) fe = 1;
                        if (DEBUG) console.log(`[Continue Watching] ${item.tmdbId} parsedMovieId=${parsedMovieId} fs=${fs} fe=${fe} mt=${mt} src=${src}`);
                        onResume(item, src, parsedMovieId, fs, fe, mt);
                    };

                    return (
                        <MovieCard
                            key={item.tmdbId}
                            item={item}
                            onClick={handleClick}
                            progressPercent={percent}
                            label={label}
                            showPlayOverlay
                        />
                    );
                })}
            </ScrollRow>
        </FadeContent>
    );
}

export const ContinueWatchingSection = memo(ContinueWatchingSectionInner);
