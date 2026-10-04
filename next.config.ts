import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The app ships the server as a standalone folder and runs it inside Electron.
  output: 'standalone',
  // The database folder is chosen at runtime, so the tracer plays safe and takes the whole project;
  // leave out what the server never reads (and the app's own build output, or it would copy itself).
  outputFileTracingExcludes: {
    '*': ['release/**', 'dist-electron/**', 'electron/**', 'e2e/**', 'shots/**', 'test-results/**', '.pglite/**', 'docs/**', 'resources/**', 'src/**', 'scripts/**', 'drizzle/**', '*.md', 'node_modules/@img/**', 'node_modules/sharp/**'],
  },
  // PGlite ships WebAssembly and data files; load it from node_modules at runtime.
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
        ],
      },
    ]
  },
}

export default nextConfig
