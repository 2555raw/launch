import type { MetadataRoute } from "next";

/** Lets walkers add Stepit to their home screen and open it like an app (needed for reminders on iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stepit",
    short_name: "Stepit",
    description: "Walk, upload your daily steps and get paid in USDG.",
    start_url: "/steps",
    scope: "/",
    display: "standalone",
    background_color: "#060807",
    theme_color: "#060807",
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
