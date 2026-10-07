import type { MetadataRoute } from "next";

/** Lets walkers add Strydo to their home screen and open it like an app (needed for reminders on iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Strydo",
    short_name: "Strydo",
    description: "Walk, upload your daily steps and get paid in ETH.",
    start_url: "/steps",
    scope: "/",
    display: "standalone",
    background_color: "#05070b",
    theme_color: "#05070b",
    icons: [
      { src: "/app/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Upload steps", url: "/steps" },
      { name: "Dashboard", url: "/dashboard" },
    ],
  };
}
