"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-32 text-center">
      <h1 className="font-serif text-2xl text-ink">Something went wrong</h1>
      <p className="max-w-md text-muted">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-brand bg-green px-5 py-2 font-ui text-white shadow-brand"
      >
        Try again
      </button>
    </div>
  );
}
