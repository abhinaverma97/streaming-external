"use client";

import Image from "next/image";
import { useState } from "react";

interface FadeImageProps {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    className?: string;
    priority?: boolean;
}

export function FadeImage({ src, alt, className = "", ...props }: FadeImageProps) {
    const [loaded, setLoaded] = useState(false);

    return (
        <Image
            src={src}
            alt={alt}
            onLoad={() => setLoaded(true)}
            className={`transition-all duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
            {...props}
        />
    );
}
