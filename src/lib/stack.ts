// What a repository is built with, read from its manifests: shown as tags and given to the AI.

const DEPENDENCY_TAGS: [RegExp, string][] = [
  [/^next$/, 'Next.js'],
  [/^react$/, 'React'],
  [/^react-native$|^expo$/, 'React Native'],
  [/^vue$|^nuxt$/, 'Vue'],
  [/^svelte$|^@sveltejs\/kit$/, 'Svelte'],
  [/^astro$/, 'Astro'],
  [/^@capacitor\/core$/, 'Capacitor'],
  [/^electron$/, 'Electron'],
  [/^phaser$|^pixi\.js$|^three$|^@react-three\/fiber$|^babylonjs$|^kaboom$/, 'Game engine'],
  [/^discord\.js$/, 'Discord bot'],
  [/^stripe$|^@stripe\//, 'Stripe'],
  [/^drizzle-orm$/, 'Drizzle'],
  [/^prisma$|^@prisma\/client$/, 'Prisma'],
  [/^@supabase\//, 'Supabase'],
  [/^@neondatabase\//, 'Neon'],
  [/^firebase$|^firebase-admin$/, 'Firebase'],
  [/^better-auth$|^next-auth$|^@clerk\//, 'Auth'],
  [/^tailwindcss$/, 'Tailwind'],
  [/^@anthropic-ai\/sdk$|^openai$|^ai$/, 'AI'],
  [/^next-intl$|^i18next$|^react-i18next$/, 'Meertalig'],
  [/^@vercel\//, 'Vercel'],
  [/^leaflet$|^mapbox-gl$|^maplibre-gl$/, 'Kaarten'],
  [/^resend$|^nodemailer$/, 'E-mail'],
  [/^express$|^fastify$|^hono$/, 'API-server'],
]

/** Tags from a package.json text; unknown or broken JSON gives none. */
export function tagsFromPackageJson(text: string): string[] {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try {
    pkg = JSON.parse(text)
  } catch {
    return []
  }
  const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]
  const tags = new Set<string>()
  for (const name of names) for (const [pattern, tag] of DEPENDENCY_TAGS) if (pattern.test(name)) tags.add(tag)
  if (names.includes('typescript')) tags.add('TypeScript')
  return [...tags]
}

const FILE_TAGS: [RegExp, string][] = [
  [/^pubspec\.yaml$/, 'Flutter'],
  [/^build\.gradle(\.kts)?$|^pom\.xml$/, 'Java/Kotlin'],
  [/^Cargo\.toml$/, 'Rust'],
  [/^go\.mod$/, 'Go'],
  [/^(requirements\.txt|pyproject\.toml)$/, 'Python'],
  [/^composer\.json$/, 'PHP'],
  [/^Gemfile$/, 'Ruby'],
  [/\.xcodeproj$|^Package\.swift$/, 'iOS (Swift)'],
  [/^ProjectSettings$|^Assets$/, 'Unity'],
  [/^project\.godot$/, 'Godot'],
  [/^Dockerfile$/, 'Docker'],
  [/^vercel\.json$/, 'Vercel'],
  [/^capacitor\.config\.(ts|json)$/, 'Capacitor'],
]

/** Tags from the names in a repository's top folder. */
export function tagsFromFileNames(names: readonly string[]): string[] {
  const tags = new Set<string>()
  for (const name of names) for (const [pattern, tag] of FILE_TAGS) if (pattern.test(name)) tags.add(tag)
  return [...tags]
}

/** Where a project's package.json may live, in the order to try: the root, then a usual app folder. */
export function packageJsonPath(topNames: readonly string[]): string | null {
  if (topNames.includes('package.json')) return 'package.json'
  const folder = ['web', 'app', 'apps', 'frontend', 'site', 'client'].find((d) => topNames.includes(d))
  if (!folder) return null
  return folder === 'apps' ? 'apps/web/package.json' : `${folder}/package.json`
}
