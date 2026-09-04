import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COGNOS — One Voice Outward. Many Minds Underneath.",
  description:
    "A personal reasoning engine. Every answer is deliberated by a council of six operators — and the Governor can veto it.",
  applicationName: "COGNOS",
};

export const viewport: Viewport = {
  themeColor: "#05070f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
