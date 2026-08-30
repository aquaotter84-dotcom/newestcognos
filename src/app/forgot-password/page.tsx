"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Password reset delivery is not wired to an email provider yet; this page
    // exists for the auth flow parity and always gives the standard "if the
    // account exists" answer.
    setSent(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#05070f" }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: "#0c0f1e", border: "1px solid #1a1f3a" }}>
        <h1 className="text-lg font-semibold text-center" style={{ color: "#c7d2fe" }}>
          Reset password
        </h1>
        {sent ? (
          <p className="text-sm text-center mt-4" style={{ color: "#94a3b8" }}>
            If an account exists with that email, you&apos;ll receive a password reset link shortly.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
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
            <button
              type="submit"
              className="w-full text-sm font-medium py-2.5 rounded-lg"
              style={{ background: "#4f7aff", color: "white" }}
            >
              Send reset link
            </button>
          </form>
        )}
        <div className="mt-5 text-center text-xs">
          <Link href="/login" style={{ color: "#4f7aff" }}>
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
