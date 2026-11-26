// @ts-check
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const CONFIG_FILE = 'qlik-cloud-tools.config.json'

/**
 * @typedef {object} Tenant
 * @property {string} context The qlik-cli context that holds this tenant's URL and API key.
 * @property {string} [timeZone] IANA zone for times printed for this tenant.
 */

/**
 * @typedef {object} Config
 * @property {Record<string, Tenant>} tenants
 * @property {string} defaultTenant
 * @property {string} timeZone
 * @property {string} qlikBin Path or name of the qlik-cli executable.
 */

/**
 * @typedef {object} ResolvedTenant
 * @property {string} name
 * @property {string} context
 * @property {string} timeZone
 */

/** @param {unknown} v */
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

/** @param {string} zone */
function checkZone(zone) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone })
  } catch {
    throw new Error(`unknown time zone: ${zone}`)
  }
  return zone
}

/**
 * Validates parsed config JSON and fills defaults. Throws with the field at fault.
 * @param {unknown} raw
 * @param {{ systemZone?: string }} [defaults]
 * @returns {Config}
 */
export function parseConfig(raw, defaults = {}) {
  if (!isObject(raw)) throw new Error('config must be a JSON object')
  const r = /** @type {Record<string, unknown>} */ (raw)
  if (!isObject(r.tenants) || Object.keys(/** @type {object} */ (r.tenants)).length === 0) {
    throw new Error('config.tenants must name at least one tenant')
  }
  const systemZone = defaults.systemZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const timeZone = checkZone(typeof r.timeZone === 'string' ? r.timeZone : systemZone)
  /** @type {Record<string, Tenant>} */
  const tenants = {}
  for (const [name, t] of Object.entries(/** @type {Record<string, unknown>} */ (r.tenants))) {
    if (!isObject(t)) throw new Error(`config.tenants.${name} must be an object`)
    const tt = /** @type {Record<string, unknown>} */ (t)
    if (typeof tt.context !== 'string' || tt.context === '') {
      throw new Error(`config.tenants.${name}.context must be a qlik-cli context name`)
    }
    /** @type {Tenant} */
    const tenant = { context: tt.context }
    if (typeof tt.timeZone === 'string') tenant.timeZone = checkZone(tt.timeZone)
    tenants[name] = tenant
  }
  const first = /** @type {string} */ (Object.keys(tenants)[0])
  const defaultTenant = typeof r.defaultTenant === 'string' ? r.defaultTenant : first
  if (!tenants[defaultTenant]) throw new Error(`config.defaultTenant "${defaultTenant}" is not in config.tenants`)
  const qlikBin = typeof r.qlikBin === 'string' && r.qlikBin !== '' ? r.qlikBin : 'qlik'
  return { tenants, defaultTenant, timeZone, qlikBin }
}

/**
 * Reads the config file: an explicit path, else $QCT_CONFIG, else ./qlik-cloud-tools.config.json.
 * $QCT_QLIK_BIN overrides qlikBin.
 * @param {{ path?: string | undefined, env?: NodeJS.ProcessEnv, cwd?: string }} [opts]
 * @returns {Config}
 */
export function loadConfig(opts = {}) {
  const env = opts.env ?? process.env
  const file = resolve(opts.cwd ?? process.cwd(), opts.path ?? env.QCT_CONFIG ?? CONFIG_FILE)
  let text
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    throw new Error(`no config at ${file}: copy qlik-cloud-tools.config.example.json there and edit it`)
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new Error(`config at ${file} is not valid JSON: ${/** @type {Error} */ (e).message}`)
  }
  const config = parseConfig(raw)
  if (env.QCT_QLIK_BIN) config.qlikBin = env.QCT_QLIK_BIN
  return config
}

/**
 * @param {Config} config
 * @param {string | undefined} name
 * @returns {ResolvedTenant}
 */
export function tenantOf(config, name) {
  const key = name ?? config.defaultTenant
  const t = config.tenants[key]
  if (!t) throw new Error(`unknown tenant "${key}"; config has: ${Object.keys(config.tenants).join(', ')}`)
  return { name: key, context: t.context, timeZone: t.timeZone ?? config.timeZone }
}
