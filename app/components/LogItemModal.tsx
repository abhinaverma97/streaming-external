"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Trash2, Star, Film, Calendar, Save, Loader2 } from "lucide-react";
import { StarRating } from "./StarRating";
import { getBackdropUrl, getPosterUrl } from "../lib/tmdb-utils";

interface LogItemModalProps {
    item: any;
    onClose: () => void;
    onRate: (movie: any, rating: number, thoughts?: string) => void;
    onDelete: (tmdbId: string) => void;
}

export function LogItemModal({ item, onClose, onRate, onDelete }: LogItemModalProps) {
    const [rating, setRating] = useState(item?.rating || 0);
    const [thoughts, setThoughts] = useState(item?.thoughts || "");
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setRating(item?.rating || 0);
        setThoughts(item?.thoughts || "");
        setConfirmingDelete(false);
        setSaving(false);
    }, [item]);

    useEffect(() => {
        if (!confirmingDelete) return;
        const t = setTimeout(() => setConfirmingDelete(false), 3000);
        return () => clearTimeout(t);
    }, [confirmingDelete]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!item || !item.movieDetails) return null;
    const movieDetails = item.movieDetails;

    const handleSave = () => {
        if (rating > 0) {
            setSaving(true);
            onRate(movieDetails, rating, thoughts);
        }
        onClose();
    };

    const handleDeleteClick = () => {
        if (!confirmingDelete) {
            setConfirmingDelete(true);
            return;
        }
        onDelete(movieDetails.id);
        onClose();
    };

    const bgImage = movieDetails.backdrop_path
        ? getBackdropUrl(movieDetails.backdrop_path)
        : movieDetails.poster_path
            ? getPosterUrl(movieDetails.poster_path)
            : null;
    const posterImage = movieDetails.poster_path
        ? getPosterUrl(movieDetails.poster_path)
        : null;

    const title = movieDetails.title || movieDetails.name || "Untitled";
    const year = (movieDetails.release_date || movieDetails.first_air_date || "").split("-")[0];
    const isTv = movieDetails.media_type === "tv" || !!movieDetails.name && !movieDetails.title;
    const tmdbVote = movieDetails.vote_average;
    const ratedAt = item.ratedAt ? new Date(item.ratedAt) : null;
    const ratedAtLabel = ratedAt
        ? ratedAt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
        : null;

    const hasChanges =
        rating !== (item.rating || 0) || thoughts !== (item.thoughts || "");

    return (
        <>
            {/* ── BACKDROP ──────────────────────────────────────── */}
            <div
                onClick={onClose}
                className="modal-backdrop fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            />

            {/* ── DESKTOP / TABLET (md+) ────────────────────────── */}
            <div
                className="modal-panel hidden md:flex fixed inset-0 z-50 items-center justify-center p-4 pointer-events-none"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="pointer-events-auto relative w-full max-w-2xl bg-[#0b0c10] border border-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Backdrop hero */}
                    <div className="relative w-full h-56 lg:h-64 bg-black overflow-hidden shrink-0">
                        {bgImage && (
                            <Image
                                src={bgImage}
                                alt={title}
                                fill
                                sizes="(min-width: 1024px) 672px, 90vw"
                                className="object-cover opacity-60"
                                priority
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/70 to-[#0b0c10]/20" />

                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 hover:bg-white/15 backdrop-blur-md border border-white/10 hover:border-white/25 flex items-center justify-center text-white/85 transition-all active:scale-95 cursor-pointer z-10"
                        >
                            <X className="w-[18px] h-[18px]" />
                        </button>

                        {/* Title block over backdrop */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end gap-4">
                            {posterImage && (
                                <div className="hidden sm:block relative w-20 aspect-[2/3] rounded-lg overflow-hidden border border-white/10 shadow-xl shrink-0">
                                    <Image
                                        src={posterImage}
                                        alt={title}
                                        fill
                                        sizes="80px"
                                        className="object-cover"
                                    />
                                </div>
                            )}
                            <div className="min-w-0 flex-1 pb-1">
                                <h2 className="text-xl lg:text-2xl font-semibold text-white leading-tight truncate">
                                    {title}
                                </h2>
                                <div className="flex items-center gap-2 mt-2 text-[10px] font-medium tracking-[0.2em] uppercase text-white/55">
                                    {year && <span>{year}</span>}
                                    {year && <span className="w-1 h-1 rounded-full bg-white/25" />}
                                    <span>{isTv ? "Series" : "Movie"}</span>
                                    {tmdbVote > 0 && (
                                        <>
                                            <span className="w-1 h-1 rounded-full bg-white/25" />
                                            <span className="flex items-center gap-1 normal-case tracking-normal">
                                                <Star className="w-3 h-3 fill-amber-300/80 text-amber-300/80" />
                                                {tmdbVote.toFixed(1)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable body */}
                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-6 py-5 flex flex-col gap-6">
                        {/* Rating block */}
                        <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-medium">
                                    Your Rating
                                </span>
                                <span className="text-xs text-white/40">
                                    {rating > 0 ? `${rating} / 5` : "Not rated"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <StarRating value={rating} onChange={setRating} />
                                {ratedAtLabel && (
                                    <span className="flex items-center gap-1.5 text-[10px] text-white/35">
                                        <Calendar className="w-3 h-3" />
                                        {ratedAtLabel}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Thoughts */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-medium">
                                Your Thoughts
                            </span>
                            <textarea
                                value={thoughts}
                                onChange={(e) => setThoughts(e.target.value)}
                                disabled={rating === 0}
                                placeholder={
                                    rating === 0
                                        ? "Rate the title first to add thoughts..."
                                        : "What did you think about it?"
                                }
                                className="w-full min-h-[140px] px-4 py-3 text-sm text-white/90 bg-white/[0.02] border border-white/[0.06] focus:border-white/20 focus:bg-white/[0.04] rounded-xl resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-white/25 leading-relaxed"
                            />
                        </div>

                        {/* Original overview reference */}
                        {movieDetails.overview && (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-medium flex items-center gap-1.5">
                                    <Film className="w-3 h-3" /> Synopsis
                                </span>
                                <p className="text-[11px] text-white/45 leading-relaxed line-clamp-3">
                                    {movieDetails.overview}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 bg-black/40 border-t border-white/[0.06] flex items-center justify-between shrink-0">
                        <button
                            onClick={handleDeleteClick}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all active:scale-95 cursor-pointer ${
                                confirmingDelete
                                    ? "text-white bg-rose-500/80 hover:bg-rose-500"
                                    : "text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10"
                            }`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            {confirmingDelete ? "Confirm delete?" : "Delete log"}
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-medium text-white/55 hover:text-white/90 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={rating === 0 || !hasChanges || saving}
                                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-black bg-white rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-all active:scale-95 shadow-lg cursor-pointer"
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                {hasChanges ? "Save changes" : "Saved"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MOBILE (<md): bottom sheet ────────────────────── */}
            <div
                onClick={onClose}
                className="modal-panel md:hidden fixed inset-0 z-50 flex items-end justify-center"
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full bg-[#0b0c10] border-t border-white/10 rounded-t-3xl shadow-[0_-12px_40px_rgba(0,0,0,0.7)] flex flex-col max-h-[92vh] animate-[slideUp_0.28s_cubic-bezier(0.16,1,0.3,1)]"
                    style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
                >
                    {/* Drag handle */}
                    <div className="flex justify-center pt-2 pb-1 shrink-0">
                        <div className="w-10 h-1 rounded-full bg-white/15" />
                    </div>

                    {/* Backdrop hero (compact) */}
                    <div className="relative w-full h-44 bg-black overflow-hidden shrink-0">
                        {bgImage && (
                            <Image
                                src={bgImage}
                                alt={title}
                                fill
                                sizes="100vw"
                                className="object-cover opacity-65"
                                priority
                            />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/60 to-transparent" />

                        <button
                            onClick={onClose}
                            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/90 active:scale-90 transition-all cursor-pointer z-10"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="absolute bottom-0 left-0 right-0 p-5">
                            <h2 className="text-xl font-semibold text-white leading-tight">
                                {title}
                            </h2>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-medium tracking-[0.2em] uppercase text-white/55 flex-wrap">
                                {year && <span>{year}</span>}
                                {year && <span className="w-1 h-1 rounded-full bg-white/25" />}
                                <span>{isTv ? "Series" : "Movie"}</span>
                                {tmdbVote > 0 && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-white/25" />
                                        <span className="flex items-center gap-1 normal-case tracking-normal">
                                            <Star className="w-3 h-3 fill-amber-300/80 text-amber-300/80" />
                                            {tmdbVote.toFixed(1)}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-4 flex flex-col gap-4">
                        {/* Rating card */}
                        <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-medium">
                                    Your Rating
                                </span>
                                <span className="text-xs text-white/40">
                                    {rating > 0 ? `${rating} / 5` : "Not rated"}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <StarRating value={rating} onChange={setRating} />
                                {ratedAtLabel && (
                                    <span className="flex items-center gap-1.5 text-[10px] text-white/35">
                                        <Calendar className="w-3 h-3" />
                                        {ratedAtLabel}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Thoughts */}
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40 font-medium">
                                Your Thoughts
                            </span>
                            <textarea
                                value={thoughts}
                                onChange={(e) => setThoughts(e.target.value)}
                                disabled={rating === 0}
                                placeholder={
                                    rating === 0
                                        ? "Rate the title first to add thoughts..."
                                        : "What did you think about it?"
                                }
                                className="w-full min-h-[120px] px-4 py-3 text-sm text-white/90 bg-white/[0.02] border border-white/[0.06] focus:border-white/20 focus:bg-white/[0.04] rounded-xl resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all placeholder:text-white/25 leading-relaxed"
                            />
                        </div>

                        {movieDetails.overview && (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[9px] uppercase tracking-[0.25em] text-white/30 font-medium flex items-center gap-1.5">
                                    <Film className="w-3 h-3" /> Synopsis
                                </span>
                                <p className="text-[11px] text-white/45 leading-relaxed line-clamp-3">
                                    {movieDetails.overview}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Mobile footer (sticky-feeling) */}
                    <div className="px-5 py-3 bg-black/40 border-t border-white/[0.06] flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleDeleteClick}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 cursor-pointer shrink-0 ${
                                confirmingDelete
                                    ? "bg-rose-500/80 text-white"
                                    : "bg-rose-500/10 text-rose-400/90 hover:bg-rose-500/15"
                            }`}
                            aria-label={confirmingDelete ? "Confirm delete" : "Delete log"}
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 h-11 rounded-xl text-xs font-medium text-white/65 bg-white/[0.03] border border-white/[0.06] active:scale-[0.98] transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={rating === 0 || !hasChanges || saving}
                            className="flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-semibold text-black bg-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {hasChanges ? "Save" : "Saved"}
                        </button>
                    </div>

                    {confirmingDelete && (
                        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-rose-500/95 text-[10px] font-semibold text-white tracking-wider uppercase shadow-lg whitespace-nowrap">
                            Tap delete again to confirm
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
