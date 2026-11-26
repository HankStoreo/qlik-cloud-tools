// Fails on a relative Markdown link to a file that isn't in the repo. External links aren't fetched (check is offline).
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const SKIP = new Set(['node_modules', '.git', 'coverage'])

/** @param {string} dir @returns {string[]} */
export function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return []
    const p = join(dir, e.name)
    if (e.isDirectory()) return markdownFiles(p)
    return e.name.endsWith('.md') ? [p] : []
  })
}

/**
 * @param {string} file
 * @param {string} text
 * @returns {string[]} relative targets that don't exist
 */
export function deadLinks(file, text) {
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
  const targets = [...body.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1] ?? '')
  return targets
    .filter((t) => !/^[a-z][a-z0-9+.-]*:/i.test(t) && !t.startsWith('#'))
    .map((t) => decodeURIComponent(t.split('#')[0] ?? ''))
    .filter((t) => t !== '' && !existsSync(resolve(dirname(file), t)))
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) {
  const root = process.cwd()
  const dead = markdownFiles(root).flatMap((f) =>
    deadLinks(f, readFileSync(f, 'utf8')).map((t) => `${relative(root, f)}: ${t}`),
  )
  if (dead.length) {
    console.error(`Dead links:\n${dead.join('\n')}`)
    process.exit(1)
  }
}
