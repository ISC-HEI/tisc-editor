import type { NextConfig } from 'next';
import { execSync } from 'child_process';

const getGitVersion = () => {
  if (process.env.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }

  try {
    const version = execSync('git describe --tags --always --first-parent --dirty=.dev', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return branch === 'main' || branch === 'master' ? version : `${version}-${branch}`;
  } catch {
    return 'v0.0.0-local';
  }
};

const nextConfig: NextConfig = {
  serverExternalPackages: ['@myriaddreamin/typst-ts-node-compiler'],
  output: 'standalone',
  env: {
    NEXT_PUBLIC_APP_VERSION: getGitVersion(),
  },
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/@img/sharp-libvips-linuxmusl-x64/**/*',
      './node_modules/@img/sharp-linuxmusl-x64/**/*',
    ],
  },
};

export default nextConfig;
