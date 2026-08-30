"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#05070f" }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center text-2xl" style={{ background: "#1a1f3a", border: "1px solid #4f7aff44", color: "#4f7aff" }}>
            ⬡
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-widest" style={{ color: "#c7d2fe", letterSpacing: "0.18em" }}>
            Create your account
          </h1>
          <p className="text-xs mt-1" style={{ color: "#475569" }}>
            Your own cognitive workspace.
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm px-3 py-2 rounded-lg" style={{ background: "#1a0505", border: "1px solid #7f1d1d44", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            required
            minLength={8}
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ background: "#080b18", border: "1px solid #1a1f3a", color: "#e2e8f0" }}
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-5 text-center text-xs" style={{ color: "#475569" }}>
          Already have one?{" "}
          <Link href="/login" className="font-medium" style={{ color: "#4f7aff" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
