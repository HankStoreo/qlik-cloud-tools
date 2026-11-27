// @ts-check
import { execFileSync } from 'node:child_process'

/**
 * Runs a command and returns its stdout. The seam tests replace.
 * @callback Exec
 * @param {string} file
 * @param {string[]} args
 * @returns {string}
 */

/** @type {Exec} */
const defaultExec = (file, args) =>
  execFileSync(file, args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })

/**
 * The one wrapper around qlik-cli. Every call runs against a named context, so the API key stays in
 * qlik-cli's own config and never passes through this code.
 * @param {{ context: string, bin?: string, exec?: Exec }} opts
 */
export function createQlik({ context, bin = 'qlik', exec = defaultExec }) {
  /** @param {string[]} args */
  const run = (...args) => {
    try {
      return exec(bin, ['--context', context, ...args])
    } catch (e) {
      const err = /** @type {NodeJS.ErrnoException & { stderr?: string }} */ (e)
      if (err.code === 'ENOENT') throw new Error(`qlik-cli not found (tried "${bin}"); install it or set qlikBin`)
      const detail = String(err.stderr ?? err.message)
        .trim()
        .split('\n')[0]
      throw new Error(`qlik ${args.join(' ')} failed: ${detail}`)
    }
  }
  /** @param {string[]} args @returns {unknown} */
  const json = (...args) => {
    const out = run(...args)
    try {
      return JSON.parse(out)
    } catch {
      throw new Error(`qlik ${args.join(' ')} did not return JSON`)
    }
  }
  /**
   * A list response, whether qlik-cli printed a bare array or a `{ data: [...] }` page.
   * @param {string[]} args
   * @returns {any[]}
   */
  const list = (...args) => {
    const x = /** @type {any} */ (json(...args))
    if (Array.isArray(x)) return x
    return Array.isArray(x?.data) ? x.data : []
  }
  /**
   * Every record of a paged REST list, following each page's `links.next.href` until there is none.
   * The next link carries the cursor in whatever form the API uses (`next=`, `page=`), so it's sent back as given.
   * @param {string} path The API path after `/api/`, e.g. `v1/spaces`.
   * @param {Record<string, string>} [query]
   * @returns {any[]}
   */
  const all = (path, query = {}) => {
    const out = []
    const seen = new Set()
    let page = { path, query }
    for (;;) {
      const x = /** @type {any} */ (json('raw', 'get', page.path, '--raw', ...queryArgs(page.query)))
      out.push(...(Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []))
      const href = x?.links?.next?.href
      if (typeof href !== 'string' || !href) return out
      if (seen.has(href))
        throw new Error(`qlik raw get ${path}: the next-page link repeats after ${seen.size + 1} pages`)
      seen.add(href)
      page = nextPage(href)
    }
  }
  return { run, json, list, all }
}

/**
 * qlik-cli's `--query` takes `key=value` as one CSV field, so a value with a comma or quote is quoted.
 * @param {Record<string, string>} query
 * @returns {string[]}
 */
export function queryArgs(query) {
  return Object.entries(query).flatMap(([k, v]) => {
    const pair = `${k}=${v}`
    return ['--query', /[",\n]/.test(pair) ? `"${pair.replaceAll('"', '""')}"` : pair]
  })
}

/**
 * A next-page link as a path after `/api/` and its query.
 * @param {string} href
 * @returns {{ path: string, query: Record<string, string> }}
 */
export function nextPage(href) {
  const url = new URL(href, 'https://tenant.invalid/')
  return { path: url.pathname.replace(/^\/(api\/)?/, ''), query: Object.fromEntries(url.searchParams) }
}

/** @typedef {ReturnType<typeof createQlik>} Qlik */
