import QRCode from "qrcode";

/**
 * QR payloads. A Payence code is a URL, so a phone camera that is not running
 * this app still lands the user somewhere useful rather than showing a blob of
 * text it cannot act on.
 */
export function payLink(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/pay/${code}`;
}

export function handleLink(origin: string, handle: string): string {
  return `${origin.replace(/\/$/, "")}/send?to=${encodeURIComponent(handle)}`;
}

/** An SVG string, rendered on the server: no QR library ships to the browser. */
export async function qrSvg(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#141414", light: "#FFFFFF" },
  });
}
