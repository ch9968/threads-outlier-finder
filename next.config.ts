import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["apify-client", "@google-cloud/vertexai"],
};

export default nextConfig;
