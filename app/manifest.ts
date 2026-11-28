import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "medBot",
    short_name: "medBot",
    description: "Practise patient interviews and build a daily learning habit.",
    lang: "en",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // --background and --accent in globals.css (the viewport also follows the dark theme).
    background_color: "#f5f5f7",
    theme_color: "#07756f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
