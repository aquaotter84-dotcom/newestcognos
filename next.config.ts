import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in Node-only files; keep it out of the webpack bundle
  // so PDF ingestion works in Vercel serverless functions.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
