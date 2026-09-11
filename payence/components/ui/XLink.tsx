const HANDLE = "usepayence";
export const X_URL = `https://x.com/${HANDLE}`;
export const X_HANDLE = `@${HANDLE}`;

/** The X mark on its own, for places that already sit inside a link. */
export function XMark({ size = 15, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** The mark as a link. Never nest this inside another anchor; use XMark there. */
export function XLink({
  className = "",
  size = 15,
  label = `Payence on X (${X_HANDLE})`,
}: {
  className?: string;
  size?: number;
  label?: string;
}) {
  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={X_HANDLE}
      className={className}
    >
      <XMark size={size} />
    </a>
  );
}
