import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_NAME, getExpectedToken } from "@/middleware";

async function loginAction(formData: FormData) {
  "use server";

  const password = formData.get("password") as string;
  const from = formData.get("from") as string;
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    throw new Error("Missing SITE_PASSWORD environment variable");
  }

  if (password !== sitePassword) {
    redirect(`/login?error=wrong&from=${encodeURIComponent(from || "/")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, getExpectedToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  redirect(from || "/");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; from?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === "wrong";
  const from = params.from || "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-950">
      <div className="w-full max-w-sm px-6">
        <h1
          className="mb-8 text-center text-5xl font-black tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Santiago
        </h1>

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="from" value={from} />

          <div>
            <input
              type="password"
              name="password"
              placeholder="Password"
              autoFocus
              required
              className="w-full rounded-lg border border-stone-700 bg-stone-800 px-4 py-3 text-stone-100 placeholder-stone-500 transition-colors duration-150 focus:border-primary focus:outline-none"
            />
          </div>

          {hasError && (
            <p className="text-sm text-error">Wrong password.</p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-stone-950 transition-colors duration-150 hover:bg-primary-hover"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
