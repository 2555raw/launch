import { qrSvg } from "@/lib/qr";

/**
 * A server-rendered QR. The markup arrives with the page, so the code is on
 * screen at first paint rather than after a client library loads.
 */
export async function QrCode({ data, size = 220, label }: { data: string; size?: number; label: string }) {
  const svg = await qrSvg(data);
  return (
    <div
      role="img"
      aria-label={label}
      className="rounded-xl border border-hair bg-white p-3"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg.replace("<svg", '<svg width="100%" height="100%"') }}
    />
  );
}
