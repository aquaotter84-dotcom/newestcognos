/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nothing server-external to exclude: the rebuild has no native/heavy
  // dependencies beyond pg (pure JS) and drizzle.
};

export default nextConfig;
