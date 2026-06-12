/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared Zod contracts are a workspace TS package; let Next transpile it.
  transpilePackages: ['@voice-agent/shared'],
  // Formatting/strictness lint is run separately (`npm run lint`); don't let it
  // block the demo build. Type checking still runs and must pass.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
