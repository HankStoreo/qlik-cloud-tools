import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { createQlik } from '../../src/qlik.mjs'
import { buildRows, fetchTenant, formatTable, PAGE, rruleWords, taskFacts, when } from '../../src/schedules.mjs'

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
  it('reads four lists, every page of each, from the current APIs', () => {
    const calls = []
    const qlik = {
      all: (path, query) => {
        calls.push([path, query])
        return []
      },
    }
    fetchTenant(qlik)
    const limit = String(PAGE)
    assert.deepEqual(calls, [
      ['v1/spaces', { limit }],
      ['v1/items', { resourceType: 'app', limit }],
      ['scheduling/tasks', { limit }],
      ['v1/reloads', { limit }],
    ])
  })

  it('shows an app whose task is on the second page of tasks as scheduled', () => {
    // Two pages of tasks, numbered the way the Scheduling Tasks API numbers them; the app's task is on page two.
    const pages = {
      'scheduling/tasks page=1': {
        data: [
          {
            id: 't-1',
            resourceId: 'app-other',
            enabled: true,
            start: { schedule: { recurrence: 'RRULE:FREQ=DAILY;BYHOUR=1;BYMINUTE=0' } },
          },
        ],
        links: { next: { href: 'https://tenant.example/api/scheduling/tasks?limit=100&page=2&sort=-updatedAt' } },
      },
      'scheduling/tasks page=2': {
        data: [
          {
            id: 't-2',
            resourceId: 'app-late',
            enabled: true,
            start: { schedule: { recurrence: 'RRULE:FREQ=DAILY;BYHOUR=6;BYMINUTE=30' } },
          },
        ],
        links: {},
      },
    }
    const exec = (_bin, args) => {
      const [, , , , path, , ...query] = args
      if (path === 'v1/items')
        return JSON.stringify({ data: [{ name: 'Late', resourceAttributes: { id: 'app-late' } }] })
      if (path !== 'scheduling/tasks') return JSON.stringify({ data: [] })
      const page = query.find((q) => q.startsWith('page=')) ?? 'page=1'
      return JSON.stringify(pages[`${path} ${page}`])
    }
    const data = fetchTenant(createQlik({ context: 'demo', exec }))
    assert.deepEqual(
      data.tasks.map((t) => t.id),
      ['t-1', 't-2'],
    )
    const [row] = buildRows(data, { timeZone: 'UTC' })
    assert.equal(row.app, 'Late')
    assert.equal(row.schedule, 'Daily 06:30')
  })
})
