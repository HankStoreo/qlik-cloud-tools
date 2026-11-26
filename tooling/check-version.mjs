// Fails when package.json's version doesn't match the newest "## vX.Y.Z" heading in CHANGELOG.md.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * @param {string} pkgText
 * @param {string} changelogText
 * @returns {string | null} the problem, or null when they agree
 */
export function versionProblem(pkgText, changelogText) {
  const { version } = JSON.parse(pkgText)
  const latest = changelogText.match(/^## v(\d+\.\d+\.\d+)/m)?.[1]
  return latest === version ? null : `package.json is ${version} but CHANGELOG.md's latest entry is v${latest}`
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) {
  const problem = versionProblem(readFileSync('package.json', 'utf8'), readFileSync('CHANGELOG.md', 'utf8'))
  if (problem) {
    console.error(problem)
    process.exit(1)
  }
}
