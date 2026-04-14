"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUTH_STORAGE_KEY } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) router.replace("/dashboard");
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!name || loading) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    localStorage.setItem(AUTH_STORAGE_KEY, name);
    router.replace("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[320px] flex flex-col gap-6"
      >
        <h1 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
          Sign in
        </h1>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-[var(--foreground)]">
            Username
          </span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            required
            className="rounded-lg border border-[var(--border)] bg-[var(--card-bg)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--muted)]"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !username.trim()}
          aria-busy={loading}
          aria-label={loading ? "Signing in" : "Continue"}
          className="inline-flex min-h-[44px] min-w-[120px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--card-bg)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {loading ? (
            <span className="app-spinner app-spinner--sm" aria-hidden />
          ) : (
            "Continue"
          )}
        </button>
      </form>
    </div>
  );
}
