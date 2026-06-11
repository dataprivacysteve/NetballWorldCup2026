import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load the repo-root .env (the laptop -> server seam) and surface the API base
// URL to the browser bundle. The value lives in .env, never hardcoded; the
// fallback only covers a missing file in local dev. Dev cwd is apps/teams.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Served behind Caddy at *.netballamericas.test, not localhost. Next's dev
  // server blocks cross-origin requests to its /_next dev assets by default,
  // which leaves the page blank — allow the local TLD. Dev-only.
  allowedDevOrigins: ["netballamericas.test", "*.netballamericas.test"],
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.API_BASE_URL ?? "https://api.netballamericas.test",
  },
};

export default nextConfig;
