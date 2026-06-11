import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Load the repo-root .env and surface the API base URL to the browser bundle.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Served behind Caddy at *.netballamericas.test, not localhost. Without this
  // the dev server blocks its own /_next dev assets cross-origin and the page
  // renders blank. Dev-only.
  allowedDevOrigins: ["netballamericas.test", "*.netballamericas.test"],
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.API_BASE_URL ?? "https://api.netballamericas.test",
  },
};

export default nextConfig;
