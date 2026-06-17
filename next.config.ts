import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
    enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
    output: "standalone",

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Permissions-Policy',
                        value: 'fullscreen=(self "https://player.videasy.net" "https://player.videasy.to" "https://vidfast.pro" "https://player.cinezo.live" "https://vidlink.pro" "https://vidnest.fun" "https://vidrock.ru")',
                    },
                ],
            },
        ];
    },

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "image.tmdb.org",
                port: "",
                pathname: "/t/p/**",
            },
        ],
    },
};

export default withBundleAnalyzer(nextConfig);
