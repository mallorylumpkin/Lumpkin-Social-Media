import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mallory Lumpkin",
    short_name: "Mallory",
    description: "Photo Studio and affiliate dashboard",
    start_url: "/studio",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#c2410c",
    icons: [
      { src: "/api/pwa-icon?s=192", sizes: "192x192", type: "image/png" },
      { src: "/api/pwa-icon?s=512", sizes: "512x512", type: "image/png" }
    ]
  };
}
