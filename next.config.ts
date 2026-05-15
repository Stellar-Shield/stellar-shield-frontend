import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow server-side env vars to be read at build time
  env: {
    BACKEND_URL: process.env.BACKEND_URL ?? "http://localhost:3001",
  },
};

export default nextConfig;
