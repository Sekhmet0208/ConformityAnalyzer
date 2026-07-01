import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Paquets natifs Node : ne pas les bundler cote serveur (laisser require natif).
  serverExternalPackages: [
    'bullmq',
    'ioredis',
    'pg',
    'stripe',
    'playwright',
    'playwright-core',
  ],
  // Le coeur de scan vit dans le dossier parent : on fige la racine de tracing
  // sur l'app web pour eviter l'avertissement "multiple lockfiles".
  outputFileTracingRoot: import.meta.dirname,
  reactStrictMode: true,
};

export default nextConfig;
