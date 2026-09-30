import "server-only";

/**
 * Pin a token image to IPFS through Pinata when PINATA_JWT is set, returning
 * ipfs://<CID>. Without a key it returns null and callers link the image this
 * site hosts instead (launchpad contracts accept any URL).
 */
export async function pinImage(image: string, name: string): Promise<string | null> {
  const jwt = process.env.PINATA_JWT;
  const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(image);
  if (!jwt || !m) return null;
  const form = new FormData();
  form.append("file", new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), `${name}.${m[1].split("/")[1]}`);
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  const data = res?.ok ? ((await res.json().catch(() => null)) as { IpfsHash?: string } | null) : null;
  return data?.IpfsHash ? `ipfs://${data.IpfsHash}` : null;
}
