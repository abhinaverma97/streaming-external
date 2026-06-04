"use client";

import { memo } from "react";
import { X } from "lucide-react";

interface SearchInputProps {
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    handleSearch: (e: React.FormEvent) => void;
    onClear?: () => void;
}

function SearchInputInner({ searchQuery, setSearchQuery, handleSearch, onClear }: SearchInputProps) {
    return (
        <form onSubmit={handleSearch} className="flex items-center justify-end gap-4 flex-1">
            <div className="relative w-48 md:w-64">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-6 py-1 bg-transparent focus:outline-none text-inherit placeholder-slate-600 transition-all duration-300"
                />
                {searchQuery && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery("");
                            if (onClear) onClear();
                        }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
        </form>
    );
}

export const SearchInput = memo(SearchInputInner);
