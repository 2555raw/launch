import { relativeTime } from "@/lib/format";

/** Relative time; server and client clocks differ by a few seconds, so hydration differences are expected. */
export function TimeAgo({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toUTCString()} suppressHydrationWarning>
      {relativeTime(iso)}
    </time>
  );
}
