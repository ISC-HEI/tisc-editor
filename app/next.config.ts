import type { NextConfig } from "next";
const { execSync } = require('child_process');

const getGitVersion = () => {
  if (process.env.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }

  try {
    const version = execSync('git describe --tags --always --first-parent --dirty=.dev', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] 
    }).trim();
    
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] 
    }).trim();
    
    return (branch === 'main' || branch === 'master') ? version : `${version}-${branch}`;
  } catch (error) {
    return "v0.0.0-local";
  }
};

const nextConfig: NextConfig = {
  serverExternalPackages: ['@myriaddreamin/typst-ts-node-compiler'],
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: getGitVersion(),
  },
};

export default nextConfig;