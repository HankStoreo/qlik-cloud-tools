import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadConfig, parseConfig, tenantOf } from '../../src/config.mjs'

const base = { tenants: { eu: { context: 'eu-ctx' }, us: { context: 'us-ctx', timeZone: 'America/Chicago' } } }

describe('parseConfig', () => {
  it('fills defaults: first tenant, system zone, qlik on the PATH', () => {
    const c = parseConfig(base, { systemZone: 'Europe/Paris' })
    assert.equal(c.defaultTenant, 'eu')
    assert.equal(c.timeZone, 'Europe/Paris')
    assert.equal(c.qlikBin, 'qlik')
  })
  it('names the field at fault', () => {
    assert.throws(() => parseConfig([]), /must be a JSON object/)
    assert.throws(() => parseConfig({ tenants: {} }), /at least one tenant/)
    assert.throws(() => parseConfig({ tenants: { a: 'x' } }), /tenants\.a must be an object/)
    assert.throws(() => parseConfig({ tenants: { a: {} } }), /tenants\.a\.context/)
    assert.throws(() => parseConfig({ ...base, defaultTenant: 'apac' }), /defaultTenant "apac"/)
    assert.throws(() => parseConfig({ ...base, timeZone: 'Mars/Olympus' }), /unknown time zone: Mars\/Olympus/)
  })
})

describe('tenantOf', () => {
  const c = parseConfig({ ...base, timeZone: 'UTC', defaultTenant: 'us' })
  it("uses the tenant's own zone, else the config's", () => {
    assert.deepEqual(tenantOf(c, undefined), { name: 'us', context: 'us-ctx', timeZone: 'America/Chicago' })
    assert.deepEqual(tenantOf(c, 'eu'), { name: 'eu', context: 'eu-ctx', timeZone: 'UTC' })
  })
  it('lists the tenants it knows when asked for another', () => {
    assert.throws(() => tenantOf(c, 'apac'), /unknown tenant "apac"; config has: eu, us/)
  })
})

describe('loadConfig', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qct-'))
  writeFileSync(join(dir, 'qlik-cloud-tools.config.json'), JSON.stringify(base))
  writeFileSync(join(dir, 'other.json'), JSON.stringify({ ...base, qlikBin: '/opt/qlik' }))
  writeFileSync(join(dir, 'bad.json'), '{ nope')
  it('reads ./qlik-cloud-tools.config.json by default', () => {
    assert.equal(loadConfig({ cwd: dir, env: {} }).defaultTenant, 'eu')
  })
  it('prefers --config, then $QCT_CONFIG', () => {
    assert.equal(loadConfig({ cwd: dir, env: { QCT_CONFIG: 'bad.json' }, path: 'other.json' }).qlikBin, '/opt/qlik')
    assert.equal(loadConfig({ cwd: dir, env: { QCT_CONFIG: 'other.json' } }).qlikBin, '/opt/qlik')
  })
  it('lets $QCT_QLIK_BIN override qlikBin', () => {
    assert.equal(loadConfig({ cwd: dir, env: { QCT_QLIK_BIN: '/x/qlik' } }).qlikBin, '/x/qlik')
  })
  it('says what to do when the file is missing or broken', () => {
    assert.throws(() => loadConfig({ cwd: dir, env: {}, path: 'missing.json' }), /no config at .*missing\.json: copy/)
    assert.throws(() => loadConfig({ cwd: dir, env: {}, path: 'bad.json' }), /not valid JSON/)
  })
})
