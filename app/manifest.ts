import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "spicy",
    short_name: "spicy",
    description: "Multi-source embed player with TMDB catalog",
    start_url: "/",
    display: "fullscreen",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/nob.png", sizes: "192x192", type: "image/png" },
      { src: "/nob.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
