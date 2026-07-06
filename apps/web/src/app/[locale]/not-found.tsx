import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <h1 className="font-serif text-2xl text-ink">Page not found</h1>
      <p className="max-w-md text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/"
        className="rounded-brand bg-green px-5 py-2 font-ui text-white shadow-brand"
      >
        Back to home
      </Link>
    </div>
  );
}
