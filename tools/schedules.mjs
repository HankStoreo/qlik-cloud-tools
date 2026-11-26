#!/usr/bin/env node
// @ts-check
// Every app in a tenant with its reload schedule, next run and last reload. Read-only.
import { parseArgs } from 'node:util'
import { loadConfig, tenantOf } from '../src/config.mjs'
import { createQlik } from '../src/qlik.mjs'
import { buildRows, fetchTenant, formatTable } from '../src/schedules.mjs'

const USAGE = `Usage: node tools/schedules.mjs [--tenant <name>] [--config <file>] [--json]

  --tenant   a tenant named in the config (default: its defaultTenant)
  --config   config file (default: $QCT_CONFIG, else ./qlik-cloud-tools.config.json)
  --json     print the rows as JSON, each with its app's tasks`

/** @param {string[]} argv */
function main(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      tenant: { type: 'string' },
      config: { type: 'string' },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) return USAGE
  const config = loadConfig({ path: values.config })
  const tenant = tenantOf(config, values.tenant)
  const qlik = createQlik({ context: tenant.context, bin: config.qlikBin })
  const rows = buildRows(fetchTenant(qlik), { timeZone: tenant.timeZone })
  if (values.json) return JSON.stringify(rows, null, 2)
  return formatTable(rows, { tenant: tenant.name, timeZone: tenant.timeZone, color: !!process.stdout.isTTY })
}

try {
  console.log(main(process.argv.slice(2)))
} catch (e) {
  console.error(`schedules: ${/** @type {Error} */ (e).message}`)
  process.exitCode = 1
}
