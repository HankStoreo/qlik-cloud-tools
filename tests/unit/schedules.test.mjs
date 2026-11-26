import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildRows, fetchTenant, formatTable, LIMITS, rruleWords, taskFacts, when } from '../../src/schedules.mjs'

const tenant = JSON.parse(readFileSync(new URL('../fixtures/tenant.json', import.meta.url), 'utf8'))
const rows = buildRows(tenant, { timeZone: 'UTC' })
const byApp = Object.fromEntries(rows.map((r) => [r.app, r]))

describe('rruleWords', () => {
  it('names weekdays, single days and hours', () => {
    assert.equal(
      rruleWords('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=5;BYMINUTE=0', 'UTC', 'UTC'),
      'Weekdays 05:00',
    )
    assert.equal(rruleWords('RRULE:FREQ=WEEKLY;BYDAY=SA;BYHOUR=9;BYMINUTE=30', 'UTC', 'UTC'), 'Sat 09:30')
    assert.equal(rruleWords('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=7', 'UTC', 'UTC'), 'Mon Wed 07:00')
    assert.equal(rruleWords('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=6', 'UTC', 'UTC'), 'Daily 06:00')
    assert.equal(rruleWords('RRULE:FREQ=DAILY;BYHOUR=6;BYMINUTE=30', 'UTC', 'UTC'), 'Daily 06:30')
    assert.equal(rruleWords('RRULE:FREQ=HOURLY;BYMINUTE=15', 'UTC', 'UTC'), 'Hourly :15')
  })
  it('shows an interval and a zone that differs from the display zone', () => {
    assert.equal(
      rruleWords('FREQ=HOURLY;INTERVAL=2;BYMINUTE=15', 'America/New_York', 'UTC'),
      'Hourly every 2 :15 America/New_York',
    )
    assert.equal(rruleWords('FREQ=DAILY;INTERVAL=3;BYHOUR=1', 'UTC', 'UTC'), 'Daily every 3 01:00')
  })
  it('falls back to the rule text when it has no words for it', () => {
    assert.equal(rruleWords('RRULE:FREQ=MONTHLY;BYMONTHDAY=1', 'UTC', 'UTC'), 'FREQ=MONTHLY;BYMONTHDAY=1')
  })
})

describe('buildRows', () => {
  it('has one row per app, sorted by space then app', () => {
    assert.deepEqual(
      rows.map((r) => `${r.space}/${r.app}`),
      [
        'Finance/Margin',
        'Finance/Revenue',
        'Operations/Rota',
        'Operations/Stock',
        'Personal/Sandbox',
        'sp-gone/Orphan',
      ],
    )
  })
  it('describes calendar, chained, disabled and missing schedules', () => {
    assert.equal(byApp.Revenue.schedule, 'Weekdays 05:00')
    assert.equal(byApp.Margin.schedule, 'after Revenue')
    assert.equal(byApp.Rota.schedule, 'Sat 09:30 (disabled)')
    assert.equal(byApp.Sandbox.schedule, 'none')
  })
  it('names the status a chained task waits for when it is not success', () => {
    const t = structuredClone(tenant)
    t.tasks[1].events[0].correlation[1].contextAttributeValue = 'failed'
    assert.equal(buildRows(t, { timeZone: 'UTC' }).find((r) => r.app === 'Margin').schedule, 'after Revenue (failed)')
    t.tasks[1].events[0].correlation[0].contextAttributeValue = 't-missing'
    assert.equal(buildRows(t, { timeZone: 'UTC' }).find((r) => r.app === 'Margin').schedule, 'after another task')
  })
  it('keeps a next run only when Qlik gives a time, not a parent name', () => {
    assert.equal(byApp.Revenue.nextRun, '2026-03-03T05:00:00Z')
    assert.equal(byApp.Margin.nextRun, null)
  })
  it('takes the newest reload from the history and says what started it', () => {
    assert.equal(byApp.Revenue.lastReload, '2026-03-02T05:01:10Z')
    assert.equal(byApp.Revenue.lastBy, 'task')
    assert.equal(byApp.Stock.lastStatus, 'FAILED')
    assert.equal(byApp.Stock.lastBy, 'API')
  })
  it('marks a reload with no history entry as unrecorded, and a never-reloaded app as null', () => {
    assert.equal(byApp.Rota.lastBy, 'unrecorded')
    assert.equal(byApp.Rota.lastStatus, null)
    assert.equal(byApp.Sandbox.lastBy, null)
  })
  it('types spaces: shared, managed, personal, and unknown for a space it cannot see', () => {
    assert.deepEqual(
      [byApp.Revenue.spaceType, byApp.Stock.spaceType, byApp.Sandbox.spaceType, byApp.Orphan.spaceType],
      ['shared', 'managed', 'personal', 'unknown'],
    )
  })
  it("carries each app's task facts for other tools", () => {
    assert.deepEqual(byApp.Margin.tasks[0], {
      id: 't-mar',
      name: 'Margin after Revenue',
      enabled: true,
      createdAt: null,
      recurrence: null,
      timezone: null,
      parentId: 't-rev',
      parentStatus: 'succeeded',
      lastRun: null,
    })
    assert.equal(byApp.Revenue.tasks[0].lastRun.status, 'succeeded')
  })
})

describe('taskFacts', () => {
  it('leaves parentId empty for a task that is not a child', () => {
    assert.equal(
      taskFacts({
        id: 'x',
        name: 'x',
        events: [{ correlation: [{ contextAttributeName: 'id', contextAttributeValue: 'y' }] }],
      }).parentId,
      null,
    )
  })
})

describe('when', () => {
  it('prints in the zone asked for', () => {
    assert.equal(when('2026-03-02T05:00:00Z', 'UTC'), 'Mon 2 Mar 05:00')
    assert.equal(when('2026-03-02T05:00:00Z', 'Asia/Tokyo'), 'Mon 2 Mar 14:00')
    assert.equal(when(null, 'UTC'), '')
  })
})

describe('formatTable', () => {
  const text = formatTable(rows, { tenant: 'demo', timeZone: 'UTC' })
  it('prints a header, one line per app and a summary', () => {
    const lines = text.split('\n')
    assert.match(lines[0], /^Space\s+App\s+Schedule\s+Next run\s+Last reload\s+Result\s+By$/)
    assert.match(text, /demo: 6 apps, 4 scheduled, 2 not\. Times UTC\./)
    assert.match(text, /Revenue\s+Weekdays 05:00\s+Tue 3 Mar 05:00\s+Mon 2 Mar 05:01\s+succeeded\s+task/)
  })
  it('prints a space name once per group and "never" for an app never reloaded', () => {
    assert.equal(text.split('\n').filter((l) => l.startsWith('Finance')).length, 1)
    assert.match(text, /Sandbox\s+none\s+never/)
  })
  it('colours failures red and unscheduled apps grey only when asked', () => {
    assert.ok(!text.includes('\x1b['))
    const coloured = formatTable(rows, { tenant: 'demo', timeZone: 'UTC', color: true })
    assert.ok(coloured.split('\n').some((l) => l.startsWith('\x1b[31m') && l.includes('Stock')))
    assert.ok(coloured.split('\n').some((l) => l.startsWith('\x1b[90m') && l.includes('Sandbox')))
  })
})

describe('fetchTenant', () => {
  it('makes four read-only calls, within the stated limits', () => {
    const calls = []
    const qlik = {
      list: (...a) => {
        calls.push(a.join(' '))
        return []
      },
    }
    fetchTenant(qlik)
    assert.deepEqual(calls, [
      `space ls --limit ${LIMITS.spaces}`,
      `item ls --resourceType app --limit ${LIMITS.apps}`,
      `raw get v1/tasks --query limit=${LIMITS.tasks}`,
      `raw get v1/reloads --query limit=${LIMITS.reloads}`,
    ])
  })
})
