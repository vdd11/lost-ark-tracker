import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build to static files in out/, which the Python server hosts in the
  // packaged app. Every page is a client component talking to /api.
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
