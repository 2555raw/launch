import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-32 text-center">
      <p className="label">404</p>
      <h1 className="display mt-4 text-5xl font-semibold">This tile is missing.</h1>
      <p className="mt-4 text-fog">The page you asked for is not part of the mosaic.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-primary">Go home</Link>
        <Link href="/explore" className="btn btn-ghost">Explore launches</Link>
      </div>
    </section>
  );
}
