import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  async redirects() {
    return [
      { source: '/dashboard', destination: '/', permanent: true },
    ]
  },
};

export default nextConfig;
