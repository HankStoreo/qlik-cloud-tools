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
  return { run, json, list }
}

/** @typedef {ReturnType<typeof createQlik>} Qlik */
