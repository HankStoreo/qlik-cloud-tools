// @ts-check

/**
 * @typedef {object} TenantData
 * @property {any[]} spaces From `qlik space ls`.
 * @property {any[]} items App items, from `qlik item ls --resourceType app`.
 * @property {any[]} tasks From GET /api/v1/tasks.
 * @property {any[]} reloads From GET /api/v1/reloads, newest first.
 */

/**
 * @typedef {object} TaskFacts
 * @property {string} id
 * @property {string} name
 * @property {boolean} enabled
 * @property {string | null} createdAt
 * @property {string | null} recurrence
 * @property {string | null} timezone
 * @property {string | null} parentId
 * @property {string | null} parentStatus
 * @property {{ startedAt: string | null, endedAt: string | null, status: string | null, triggeredBy: string | null } | null} lastRun
 */

/**
 * @typedef {object} Row
 * @property {string} space
 * @property {string | null} spaceId
 * @property {string} spaceType shared, managed, data, personal or unknown
 * @property {string} app
 * @property {string} id
 * @property {string} schedule
 * @property {string | null} nextRun
 * @property {string | null} lastReload
 * @property {string | null} lastStatus
 * @property {string | null} lastStarted
 * @property {string | null} lastBy task, browser, API, unrecorded, or null if never reloaded
 * @property {TaskFacts[]} tasks
 */

export const LIMITS = { spaces: 100, apps: 200, tasks: 100, reloads: 100 }

/**
 * Reads what the schedule view needs. Four read-only calls.
 * @param {import('./qlik.mjs').Qlik} qlik
 * @returns {TenantData}
 */
export function fetchTenant(qlik) {
  return {
    spaces: qlik.list('space', 'ls', '--limit', String(LIMITS.spaces)),
    items: qlik.list('item', 'ls', '--resourceType', 'app', '--limit', String(LIMITS.apps)),
    tasks: qlik.list('raw', 'get', 'v1/tasks', '--query', `limit=${LIMITS.tasks}`),
    reloads: qlik.list('raw', 'get', 'v1/reloads', '--query', `limit=${LIMITS.reloads}`),
  }
}

const DAYS = /** @type {Record<string, string>} */ ({
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
})
/** @param {string | number} n */
const pad2 = (n) => String(n).padStart(2, '0')

/**
 * An RRULE in words: "Weekdays 05:00", "Daily 06:30", "Hourly :15", "Sat 09:00". The zone is named only when it
 * differs from the zone the table prints in.
 * @param {string} rrule
 * @param {string | null | undefined} tz The task's own zone.
 * @param {string} displayZone
 */
export function rruleWords(rrule, tz, displayZone) {
  const body = rrule.replace(/^RRULE:/, '')
  /** @type {Record<string, string>} */
  const r = Object.fromEntries(body.split(';').map((p) => /** @type {[string, string]} */ (p.split('='))))
  const minute = pad2(r.BYMINUTE?.split(',')[0] ?? 0)
  const at = r.BYHOUR !== undefined ? `${pad2(r.BYHOUR.split(',')[0] ?? 0)}:${minute}` : ''
  const every = Number(r.INTERVAL ?? 1) > 1 ? ` every ${r.INTERVAL}` : ''
  const zone = tz && tz !== displayZone ? ` ${tz}` : ''
  if (r.FREQ === 'HOURLY') return `Hourly${every} :${minute}${zone}`
  if (r.FREQ === 'DAILY') return `Daily${every} ${at}${zone}`.trimEnd()
  if (r.FREQ === 'WEEKLY' && r.BYDAY) {
    const d = r.BYDAY.split(',')
    const days =
      d.join() === 'MO,TU,WE,TH,FR' ? 'Weekdays' : d.length === 7 ? 'Daily' : d.map((x) => DAYS[x] ?? x).join(' ')
    return `${days}${every} ${at}${zone}`.trimEnd()
  }
  return body
}

/**
 * A chained task's trigger: the parent task's id and the status it waits for, from events[0].correlation.
 * @param {any} task
 * @returns {Record<string, string>}
 */
function correlation(task) {
  const attrs = task?.events?.[0]?.correlation ?? []
  return Object.fromEntries(attrs.map((/** @type {any} */ a) => [a.contextAttributeName, a.contextAttributeValue]))
}

/**
 * @param {any} task
 * @returns {TaskFacts}
 */
export function taskFacts(task) {
  const s = task.start?.schedule
  const c = correlation(task)
  const run = task.metadata?.orchestration?.lastRun
  return {
    id: task.id,
    name: task.name,
    enabled: !!task.enabled,
    createdAt: task.metadata?.createdAt ?? null,
    recurrence: s?.recurrence ?? null,
    timezone: s?.timezone ?? null,
    parentId: task.metadata?.topology?.isChild ? (c.id ?? null) : null,
    parentStatus: c.status ?? null,
    lastRun: run
      ? {
          startedAt: run.startedAt ?? null,
          endedAt: run.endedAt ?? null,
          status: run.status ?? null,
          triggeredBy: run.triggeredBy ?? null,
        }
      : null,
  }
}

/** @param {unknown} v */
const isTime = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

// Reload types in the history: choreographer is a task, hub the app's reload button, external the API or qlik-cli.
const BY = /** @type {Record<string, string>} */ ({ choreographer: 'task', hub: 'browser', external: 'API' })

/**
 * One row per app: its space, schedule in words, next run and last reload.
 * @param {TenantData} data
 * @param {{ timeZone: string }} opts
 * @returns {Row[]}
 */
export function buildRows({ spaces, items, tasks, reloads }, { timeZone }) {
  const spaceName = new Map(spaces.map((s) => [s.id, s.name]))
  const spaceType = new Map(spaces.map((s) => [s.id, s.type]))
  const appName = new Map(items.map((i) => [i.resourceAttributes?.id, i.name]))

  /** @param {any} task */
  const describe = (task) => {
    if (!task) return 'none'
    const s = task.start?.schedule
    let words = 'on an event'
    if (s?.recurrence) words = rruleWords(s.recurrence, s.timezone, timeZone)
    else if (task.metadata?.topology?.isChild) {
      const c = correlation(task)
      const parent = tasks.find((t) => t.id === c.id)
      const name = parent ? (appName.get(parent.resourceId) ?? parent.name) : null
      const status = c.status && c.status !== 'succeeded' ? ` (${c.status})` : ''
      words = name ? `after ${name}${status}` : 'after another task'
    }
    return task.enabled ? words : `${words} (disabled)`
  }

  return items
    .map((i) => {
      const id = i.resourceAttributes?.id
      const appTasks = tasks.filter((t) => t.resourceId === id)
      const task = appTasks[0]
      const last = reloads.find((r) => r.appId === id)
      const recorded = i.resourceAttributes?.lastReloadTime ?? null
      // next_run_at is a time for a calendar task; for a chained task Qlik puts the parent's name there.
      const next = task?.metadata?.orchestration?.attrs?.next_run_at
      /** @type {Row} */
      const row = {
        space: i.spaceId ? (spaceName.get(i.spaceId) ?? i.spaceId) : 'Personal',
        spaceId: i.spaceId || null,
        spaceType: i.spaceId ? (spaceType.get(i.spaceId) ?? 'unknown') : 'personal',
        app: i.name,
        id,
        schedule: describe(task),
        nextRun: isTime(next) ? next : null,
        lastReload: last?.creationTime ?? recorded,
        lastStatus: last?.status ?? null,
        lastStarted: last?.startTime ?? null,
        // A reload in the data load editor, or one older than the history, leaves no history entry.
        lastBy: last ? (BY[last.type] ?? last.type) : recorded ? 'unrecorded' : null,
        tasks: appTasks.map(taskFacts),
      }
      return row
    })
    .sort((a, b) => a.space.localeCompare(b.space) || a.app.localeCompare(b.app))
}

/**
 * @param {string | null} iso
 * @param {string} timeZone
 */
export function when(iso, timeZone) {
  if (!iso) return ''
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return f.format(new Date(iso)).replace(',', '')
}

/**
 * The plain table. Colour (failures red, unscheduled grey) only when asked, for a terminal.
 * @param {Row[]} rows
 * @param {{ tenant: string, timeZone: string, color?: boolean }} opts
 */
export function formatTable(rows, { tenant, timeZone, color = false }) {
  /** @param {string} code @param {string} s */
  const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s)
  const head = ['Space', 'App', 'Schedule', 'Next run', 'Last reload', 'Result', 'By']
  const cells = rows.map((r) => [
    r.space,
    r.app,
    r.schedule,
    when(r.nextRun, timeZone),
    when(r.lastReload, timeZone),
    r.lastStatus ? r.lastStatus.toLowerCase() : r.lastReload ? '' : 'never',
    r.lastBy ?? '',
  ])
  const width = head.map((h, c) => Math.max(h.length, ...cells.map((row) => (row[c] ?? '').length)))
  /** @param {string[]} row */
  const line = (row) =>
    row
      .map((v, c) => v.padEnd(width[c] ?? 0))
      .join('  ')
      .trimEnd()
  const out = [paint('1', line(head))]
  let space = null
  for (const [k, row] of cells.entries()) {
    const r = /** @type {Row} */ (rows[k])
    const shown = [...row]
    if (r.space === space) shown[0] = ''
    space = r.space
    let text = line(shown)
    if (r.lastStatus === 'FAILED') text = paint('31', text)
    else if (r.schedule === 'none') text = paint('90', text)
    out.push(text)
  }
  const scheduled = rows.filter((r) => r.schedule !== 'none').length
  out.push(
    '',
    `${tenant}: ${rows.length} apps, ${scheduled} scheduled, ${rows.length - scheduled} not. Times ${timeZone}.`,
    'By: task, browser (reload button) or API come from the reload history. "unrecorded" is a reload with no history',
    'entry: the data load editor, or one older than the history.',
  )
  return out.join('\n')
}
