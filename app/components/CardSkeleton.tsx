"use client";

import { memo } from "react";

interface CardSkeletonProps {
    count?: number;
    layout?: "row" | "grid";
}

function CardSkeletonInner({ count = 6, layout = "row" }: CardSkeletonProps) {
    const skeletons = Array.from({ length: count });

    if (layout === "grid") {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-3 gap-y-6 md:gap-x-5 md:gap-y-10">
                {skeletons.map((_, i) => (
                    <div key={i} className="flex flex-col w-full">
                        <div className="aspect-[16/9] w-full rounded-xl bg-slate-900/60 border border-slate-800/30 animate-pulse" />
                        <div className="mt-2.5 h-3.5 bg-slate-900/60 rounded-full w-2/3 animate-pulse" />
                        <div className="mt-1.5 h-2.5 bg-slate-900/40 rounded-full w-1/3 animate-pulse" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex gap-4 overflow-hidden py-6 -my-4 px-2 -mx-2">
            {skeletons.map((_, i) => (
                <div key={i} className="flex-none w-[calc((100%-1rem)/2)] sm:w-[calc((100%-2rem)/3)] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]">
                    <div className="aspect-[16/9] w-full rounded-xl bg-slate-900/60 border border-slate-800/30 animate-pulse" />
                    <div className="mt-2.5 h-3.5 bg-slate-900/60 rounded-full w-2/3 animate-pulse" />
                </div>
            ))}
        </div>
    );
}

export const CardSkeleton = memo(CardSkeletonInner);
