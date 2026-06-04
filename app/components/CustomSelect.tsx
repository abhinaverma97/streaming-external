"use client";

import { useState, useEffect, useRef, memo } from "react";
import { ChevronDown } from "lucide-react";

interface CustomSelectProps {
    value: any;
    onChange: (val: any) => void;
    options: { value: any; label: string }[];
    className?: string;
}

function CustomSelectInner({ value, onChange, options, className = "" }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find((o) => o.value === value) || options[0];

    return (
        <div ref={ref} className={`relative flex flex-col w-full ${className}`}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 cursor-pointer transition-all duration-200"
            >
                <span className="truncate">{selectedOption?.label || "Select..."}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#0b0c10] border border-white/10 rounded-xl overflow-hidden z-[100] shadow-2xl max-h-48 overflow-y-auto no-scrollbar">
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-3 py-2 text-xs cursor-pointer transition-colors ${value === opt.value ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'}`}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export const CustomSelect = memo(CustomSelectInner);
