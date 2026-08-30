"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// "next" holds an internal path (e.g. "/memory"). Reject anything that
// isn't a plain relative path to avoid open redirects.
function safeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in (e.g. admin auto sign-in, or an existing session)?
  // Go straight into the app instead of showing the login screen.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((user) => {
        if (!cancelled && user) router.replace(next || "/");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.push(next || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#05070f" }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl council-active" style={{ background: "linear-gradient(135deg, #1e3a8a, #4f7aff22)", border: "1px solid #4f7aff44", color: "#4f7aff" }}>
            ⬡
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-widest" style={{ color: "#c7d2fe", letterSpacing: "0.18em" }}>
            COGNOS
          </h1>
          <p className="text-xs mt-1" style={{ color: "#475569" }}>
            One Voice Outward. Many Minds Underneath.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            autoFocus
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full text-sm font-medium py-2.5 rounded-lg"
            style={{ background: "linear-gradient(135deg, #4f7aff, #7c3aed)", color: "white" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs space-y-2" style={{ color: "#475569" }}>
          <div>
            No account?{" "}
            <Link href="/register" className="font-medium" style={{ color: "#4f7aff" }}>
              Create one
            </Link>
          </div>
          <div>
            <Link href="/forgot-password" style={{ color: "#475569" }}>
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
