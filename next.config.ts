import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Hide the dev-only Next.js indicator so it doesn't float over the UI.
  devIndicators: false,
};

export default nextConfig;
