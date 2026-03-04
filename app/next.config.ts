import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@myriaddreamin/typst-ts-node-compiler'],
  output: 'standalone',
};

export default nextConfig;
