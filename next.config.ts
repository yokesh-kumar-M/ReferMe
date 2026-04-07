import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Allow your local network IP (like phones or other computers) to access the dev server
  allowedDevOrigins: ["192.168.1.3", "localhost"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
