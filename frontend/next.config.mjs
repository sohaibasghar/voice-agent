import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared Zod contracts are a workspace TS package; let Next transpile it.
  transpilePackages: ['@voice-agent/shared'],
  // Monorepo: pin file-tracing root so Next doesn't warn about multiple lockfiles.
  outputFileTracingRoot: repoRoot,
  // Formatting/strictness lint is run separately (`npm run lint`); don't let it
  // block the demo build. Type checking still runs and must pass.
  eslint: { ignoreDuringBuilds: true },
  // Avoid the Next 15.5 dev-tools "Segment Explorer" RSC-manifest crash
  // (segment-explorer-node) seen in dev mode.
  experimental: { devtoolSegmentExplorer: false },
};

export default nextConfig;
