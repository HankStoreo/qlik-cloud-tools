import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const cli = fileURLToPath(new URL('../../tools/schedules.mjs', import.meta.url))
const fake = fileURLToPath(new URL('../fixtures/fake-qlik.mjs', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'qct-cli-'))
writeFileSync(
  join(dir, 'qlik-cloud-tools.config.json'),
  JSON.stringify({ timeZone: 'UTC', tenants: { demo: { context: 'demo' }, broken: { context: 'broken' } } }),
)
const env = { ...process.env, QCT_QLIK_BIN: fake, QCT_CONFIG: '' }
delete env.QCT_CONFIG
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, env, encoding: 'utf8' })

describe('tools/schedules.mjs against a fake qlik-cli', () => {
  it('prints the table for the default tenant', () => {
    const out = execFileSync(process.execPath, [cli], { cwd: dir, env, encoding: 'utf8' })
    assert.match(out, /demo: 6 apps, 4 scheduled, 2 not\. Times UTC\./)
  })
  it('prints rows as JSON', () => {
    const r = run('--json')
    assert.equal(r.status, 0)
    assert.equal(JSON.parse(r.stdout).length, 6)
  })
  it('prints usage for --help', () => {
    assert.match(run('--help').stdout, /^Usage: node tools\/schedules\.mjs/)
  })
  it('fails with one clear line when qlik-cli fails', () => {
    const r = run('--tenant', 'broken')
    assert.equal(r.status, 1)
    assert.equal(
      r.stderr.trim(),
      'schedules: qlik raw get v1/spaces --raw --query limit=100 failed: Error: context broken has no API key',
    )
  })
  it('fails with one clear line for an unknown tenant', () => {
    const r = run('--tenant', 'nope')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /^schedules: unknown tenant "nope"/)
  })
})
