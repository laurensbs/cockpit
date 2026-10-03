import { describe, expect, it } from 'vitest'
import { packageJsonPath, tagsFromFileNames, tagsFromPackageJson } from './stack'

describe('stack tags', () => {
  it('reads frameworks and services from package.json', () => {
    const pkg = JSON.stringify({
      dependencies: { next: '16', react: '19', 'drizzle-orm': '0.45', '@capacitor/core': '8', stripe: '1', 'next-intl': '4' },
      devDependencies: { typescript: '5' },
    })
    expect(tagsFromPackageJson(pkg).sort()).toEqual(['Capacitor', 'Drizzle', 'Meertalig', 'Next.js', 'React', 'Stripe', 'TypeScript'])
  })

  it('ignores broken JSON', () => {
    expect(tagsFromPackageJson('{oops')).toEqual([])
  })

  it('reads other ecosystems from file names', () => {
    expect(tagsFromFileNames(['build.gradle', 'README.md', 'Dockerfile']).sort()).toEqual(['Docker', 'Java/Kotlin'])
    expect(tagsFromFileNames(['project.godot'])).toEqual(['Godot'])
  })

  it('finds the package.json in the root or a usual app folder', () => {
    expect(packageJsonPath(['package.json', 'web'])).toBe('package.json')
    expect(packageJsonPath(['docs', 'web', 'ios'])).toBe('web/package.json')
    expect(packageJsonPath(['apps', 'packages'])).toBe('apps/web/package.json')
    expect(packageJsonPath(['src', 'README.md'])).toBeNull()
  })
})
