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
      { src: "/nob.png", sizes: "any", type: "image/png", purpose: "any" },

    ],
  };
}
