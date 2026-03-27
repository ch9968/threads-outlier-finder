import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950">
      <p className="mb-4 text-sm text-stone-400">Page not found</p>
      <Link
        href="/"
        className="rounded-md border border-stone-700 px-4 py-2 text-sm text-stone-300 transition-colors duration-150 hover:border-stone-500"
      >
        Go home
      </Link>
    </div>
  );
}
