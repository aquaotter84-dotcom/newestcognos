import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "COGNOS — Cognitive Architecture",
  description:
    "Cognitive Operators for Guidance, Navigation, Oversight, and Sovereignty. A model-agnostic cognitive architecture designed to think with you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
