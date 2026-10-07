/** Starts server-side background jobs once per process (Node runtime only). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
