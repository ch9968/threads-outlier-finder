import { redirect } from "next/navigation";
import { startScraping } from "@/lib/actions/scraping";

async function analyzeAction(formData: FormData) {
  "use server";

  const result = await startScraping(formData);

  if (result.error) {
    const username = (formData.get("username") as string) || "";
    redirect(`/?error=${encodeURIComponent(result.error)}&username=${encodeURIComponent(username)}`);
  }

  const username = (formData.get("username") as string).toLowerCase();
  redirect(`/results/${username}`);
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; username?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-6">
      <div className="w-full max-w-lg text-center">
        {/* Brand */}
        <h1
          className="mb-2 text-5xl font-black tracking-tight text-stone-100"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Santiago
        </h1>
        <p className="mb-12 text-sm text-stone-400">
          Threads Outlier Analyzer
        </p>

        {/* Input */}
        <form action={analyzeAction}>
          <div className="flex items-center overflow-hidden rounded-lg border border-stone-700 bg-stone-800 transition-colors duration-150 focus-within:border-primary">
            <span className="pl-4 text-stone-500">@</span>
            <input
              type="text"
              name="username"
              placeholder="threads username"
              defaultValue={params.username || ""}
              autoFocus
              required
              className="flex-1 bg-transparent px-2 py-3.5 text-stone-100 placeholder-stone-500 focus:outline-none"
            />
            <button
              type="submit"
              className="mr-1.5 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-stone-950 transition-colors duration-150 hover:bg-primary-hover"
            >
              Analyze
            </button>
          </div>
        </form>

        {params.error && (
          <p className="mt-4 text-sm text-error">{params.error}</p>
        )}
      </div>
    </div>
  );
}
