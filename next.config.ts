import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The app ships the server as a standalone folder and runs it inside Electron.
  output: 'standalone',
  // The database folder is chosen at runtime, so the tracer plays safe and takes the whole project;
  // leave out what the server never reads (and the app's own build output, or it would copy itself).
  outputFileTracingExcludes: {
    '*': ['release/**', 'dist-electron/**', 'electron/**', 'e2e/**', 'shots/**', 'test-results/**', '.pglite/**', 'docs/**', 'resources/**', 'src/**', 'scripts/**', 'drizzle/**', '*.md', 'node_modules/@img/**', 'node_modules/sharp/**', 'media/**', 'assets/fonts/*.txt'],
  },
  // PGlite and resvg ship WebAssembly; load them from node_modules at runtime.
  serverExternalPackages: ['@electric-sql/pglite', '@resvg/resvg-wasm', 'satori', 'harfbuzzjs'],
  // The renderer reads these from disk (fonts for the slides, resvg's WebAssembly), so trace them in.
  outputFileTracingIncludes: {
    '*': ['assets/fonts/**', 'node_modules/@resvg/resvg-wasm/index_bg.wasm', 'node_modules/harfbuzzjs/*.wasm', 'node_modules/harfbuzzjs/*.js'],
  },
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
