"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import { Icon } from "@/components/ui/Icons";

/**
 * The QR scanner.
 *
 * Camera access is a browser permission that can be refused or be unavailable
 * (an insecure origin, an in-app browser, a desktop with no camera), so the
 * manual code entry is not a fallback bolted on afterwards: it is always on the
 * page, and the scanner is the enhancement.
 */
export function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;
    // The decoder is ~45 KB and only matters once the camera is on, so it is
    // fetched here rather than in the page bundle.
    let decode: typeof import("jsqr").default | null = null;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!cancelled && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx && decode) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = decode(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
          if (found?.data) {
            const code = extractCode(found.data);
            if (code) {
              cancelled = true;
              stream?.getTracks().forEach((t) => t.stop());
              router.push(`/checkout/${code}`);
              return;
            }
          }
        }
      }
      if (!cancelled) frame = requestAnimationFrame(tick);
    };

    Promise.all([
      import("jsqr").then((m) => {
        decode = m.default;
      }),
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } }) ??
        Promise.reject(new Error("no camera")),
    ])
      .then(([, s]) => {
        if (cancelled) {
          (s as MediaStream).getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s as MediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        frame = requestAnimationFrame(tick);
      })
      .catch(() => {
        setScanning(false);
        setError("Payence could not open the camera. Check the permission, or enter the code below.");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, router]);

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="relative aspect-[4/3] bg-ink">
          {scanning ? (
            <>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 m-auto h-52 w-52 rounded-2xl border-2 border-canvas/80"
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-canvas">
              <Icon.scan className="h-10 w-10 opacity-70" />
              <p className="max-w-[28ch] text-[14px] text-canvas/70">
                Point your camera at the merchant&apos;s Payence code.
              </p>
              <Button onClick={() => { setError(null); setScanning(true); }} variant="invert" size="md">
                Start camera
              </Button>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>
        {scanning && (
          <div className="flex items-center justify-between px-5 py-3.5">
            <p className="text-[13px] text-muted">Looking for a code…</p>
            <Button onClick={() => setScanning(false)} variant="ghost" size="sm">
              Stop
            </Button>
          </div>
        )}
      </section>

      {error && <Alert tone="warning">{error}</Alert>}

      <form
        className="card space-y-4 px-5 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("code");
          const code = extractCode(String(value ?? ""));
          if (code) router.push(`/checkout/${code}`);
          else setError("That does not look like a Payence payment code.");
        }}
      >
        <Field label="Enter a code" htmlFor="code" hint="The short code printed under the merchant's QR.">
          <Input
            id="code"
            name="code"
            placeholder="ABCD234XYZ"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono tracking-[0.15em]"
          />
        </Field>
        <Button type="submit" variant="secondary" size="md" full>
          Continue
        </Button>
      </form>
    </div>
  );
}

/** Accepts a full Payence URL or a bare code, and rejects anything else. */
function extractCode(raw: string): string | null {
  const value = raw.trim();
  const fromUrl = value.match(/\/(?:pay|checkout)\/([A-Z0-9]{6,16})/i);
  if (fromUrl) return fromUrl[1].toUpperCase();
  if (/^[A-Z0-9]{6,16}$/i.test(value)) return value.toUpperCase();
  return null;
}
