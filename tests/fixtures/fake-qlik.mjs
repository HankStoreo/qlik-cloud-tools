#!/usr/bin/env node
// Stands in for qlik-cli in tests: answers `qlik raw get <path> --raw` from tenant.json, offline.
// It pages like a tenant past its page limit: at most PAGE_MAX records per page whatever limit is asked for,
// with a next link in the form each API uses (an opaque `next` cursor, or `page` for the Scheduling Tasks API).
import { readFileSync } from 'node:fs'

const PAGE_MAX = 2
const data = JSON.parse(readFileSync(new URL('tenant.json', import.meta.url), 'utf8'))
const args = process.argv.slice(2)
if (args[0] !== '--context' || !args[1]) {
  console.error('fake-qlik: expected --context <name>')
  process.exit(2)
}
if (args[1] === 'broken') {
  console.error('Error: context broken has no API key')
  process.exit(1)
}
const fail = (/** @type {string} */ why) => {
  console.error(`fake-qlik: ${why}: "${args.slice(2).join(' ')}"`)
  process.exit(2)
}
const [cmd, verb, path, ...rest] = args.slice(2)
if (cmd !== 'raw' || verb !== 'get' || !rest.includes('--raw')) fail('expected raw get <path> --raw')

/** @type {Record<string, string>} */
const query = {}
for (let i = 0; i < rest.length; i++) {
  if (rest[i] !== '--query') continue
  const field = rest[++i].replace(/^"(.*)"$/s, '$1').replaceAll('""', '"')
  const at = field.indexOf('=')
  query[field.slice(0, at)] = field.slice(at + 1)
}

const lists = /** @type {Record<string, { records: any[], style: 'cursor' | 'page' }>} */ ({
  'v1/spaces': { records: data.spaces, style: 'cursor' },
  'v1/items': { records: query.resourceType === 'app' ? data.items : [], style: 'cursor' },
  'scheduling/tasks': { records: data.tasks, style: 'page' },
  'v1/reloads': { records: data.reloads, style: 'cursor' },
})
const list = lists[path]
if (!list) fail('no answer')

const size = Math.min(Number(query.limit) || 10, PAGE_MAX)
const start =
  list.style === 'page'
    ? (Number(query.page ?? 1) - 1) * size
    : Number(Buffer.from(query.next ?? '', 'base64url').toString() || 0)
const end = start + size
/** @type {any} */
const links = { self: { href: href(query) } }
if (end < list.records.length) {
  const next =
    list.style === 'page'
      ? { page: String(Number(query.page ?? 1) + 1) }
      : { next: Buffer.from(String(end)).toString('base64url') }
  links.next = { href: href({ ...query, ...next }) }
}
console.log(JSON.stringify({ data: list.records.slice(start, end), links }))

/** @param {Record<string, string>} q */
function href(q) {
  return `https://tenant.example/api/${path}?${new URLSearchParams(q)}`
}
