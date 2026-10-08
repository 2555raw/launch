// Short proof links: https://heldat.xyz/p/<id>#<key>
//
// The receipt is encrypted here, in the browser, with a fresh 128-bit key
// (AES-GCM). The server keeps only the ciphertext under a short random id; the
// key travels after the #, which browsers never send to a server. So the server
// stores what it cannot read, and the link stays private like the long one.
// The long link (#obx1_…) keeps working without the server at all.

export const SHORT_ID = /^[A-Za-z0-9]{8}$/;
const KEY_TEXT = /^[A-Za-z0-9_-]{22}$/;

const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const unb64u = (text) => Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

// text -> { ct, key }: the ciphertext (iv first) and the key, both base64url.
export async function sealText(text) {
  const raw = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text)));
  const ct = new Uint8Array(iv.length + body.length);
  ct.set(iv); ct.set(body, iv.length);
  return { ct: b64u(ct), key: b64u(raw) };
}

// Throws if the key is wrong or anything was changed: AES-GCM checks both.
export async function openText(ct, keyText) {
  if (!KEY_TEXT.test(keyText)) throw new Error("This short link is missing part of its key");
  const bytes = unb64u(ct);
  const key = await crypto.subtle.importKey("raw", unb64u(keyText), "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(plain);
}

// Upload the sealed receipt and return the short link. `expires` (unix seconds,
// optional) lets the server drop it once the proof has run out anyway.
export async function createShortLink(text, { expires, origin = location.origin } = {}) {
  const { ct, key } = await sealText(text);
  const res = await fetch(new URL("/api/link", origin), {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(expires ? { ct, expires } : { ct }),
  });
  if (!res.ok) throw new Error(`Short link not created (${res.status})`);
  const { id } = await res.json();
  if (!SHORT_ID.test(id)) throw new Error("Short link not created");
  return `${new URL(origin).origin}/p/${id}#${key}`;
}

// Fetch and decrypt. err.gone is set when the server no longer has the link.
export async function openShortLink(id, keyText, origin = location.origin) {
  if (!SHORT_ID.test(id)) throw Object.assign(new Error("Not a short link"), { gone: true });
  const res = await fetch(new URL(`/api/link/${id}`, origin), { cache: "no-store" });
  if (res.status === 404) throw Object.assign(new Error("This link has expired or was removed"), { gone: true });
  if (!res.ok) throw new Error(`The link could not be loaded (${res.status})`);
  const { ct } = await res.json();
  return openText(ct, keyText);
}
