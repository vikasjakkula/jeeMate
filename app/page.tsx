"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AUTH_STORAGE_KEY } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (localStorage.getItem(AUTH_STORAGE_KEY)) router.replace("/dashboard");
    else router.replace("/login");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <span className="app-spinner" role="status" aria-label="Please wait" />
    </div>
  );
}
