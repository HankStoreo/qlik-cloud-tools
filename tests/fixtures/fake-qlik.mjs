#!/usr/bin/env node
// Stands in for qlik-cli in tests: answers the four read calls from tenant.json, offline.
import { readFileSync } from 'node:fs'

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
const cmd = args.slice(2).join(' ')
const answers = [
  [/^space ls/, data.spaces],
  [/^item ls --resourceType app/, data.items],
  [/^raw get v1\/tasks/, { data: data.tasks, links: {} }],
  [/^raw get v1\/reloads/, { data: data.reloads, links: {} }],
]
const hit = answers.find(([re]) => re.test(cmd))
if (!hit) {
  console.error(`fake-qlik: no answer for "${cmd}"`)
  process.exit(2)
}
console.log(JSON.stringify(hit[1]))
