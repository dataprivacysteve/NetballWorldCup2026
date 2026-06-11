import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served behind Caddy at *.netballamericas.test, not localhost. Without this
  // the dev server blocks its own /_next dev assets cross-origin and the page
  // renders blank. Dev-only.
  allowedDevOrigins: ["netballamericas.test", "*.netballamericas.test"],
};

export default nextConfig;
