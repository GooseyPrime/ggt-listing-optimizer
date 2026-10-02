import type { NextConfig } from "next";

/**
 * Served inside the shop at /tools/listing-optimizer: the shop rewrites that path to this
 * deployment, so the app is built with the same basePath. Set NEXT_PUBLIC_BASE_PATH=""
 * for a standalone root deploy.
 */
const rawBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "/tools/listing-optimizer";
const basePath = rawBase.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
