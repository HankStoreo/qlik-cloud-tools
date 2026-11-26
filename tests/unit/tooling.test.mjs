import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { deadLinks } from '../../tooling/check-links.mjs'
import { versionProblem } from '../../tooling/check-version.mjs'

const trailers = fileURLToPath(new URL('../../tooling/check-trailers.sh', import.meta.url))
const scan = (text) => spawnSync('sh', [trailers, '-'], { input: text, encoding: 'utf8' })

describe('check-trailers (Q7)', () => {
  it('passes an ordinary message', () => {
    assert.equal(scan('feat: add schedules\n\nCo-authored-by: A Person <a@example.com>\n').status, 0)
  })
  for (const line of [
    'Co-Authored-By: Claude Opus <noreply@anthropic.com>',
    'Claude-Session: https://example.com/x',
    'see https://claude.ai/code/session_abc',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
  ]) {
    it(`rejects: ${line}`, () => {
      const r = scan(`fix: thing\n\n${line}\n`)
      assert.equal(r.status, 1)
      assert.match(r.stderr, /AI attribution found/)
    })
  }
  it('reads a message file, as the commit-msg hook does', () => {
    const f = join(mkdtempSync(join(tmpdir(), 'qct-msg-')), 'MSG')
    writeFileSync(f, 'Claude-Session: x\n')
    assert.equal(spawnSync('sh', [trailers, f]).status, 1)
  })
})

describe('check-version (C7)', () => {
  it('agrees when the manifest matches the newest changelog heading', () => {
    assert.equal(versionProblem('{"version":"0.2.0"}', '# Changelog\n\n## v0.2.0 · b\n\n## v0.1.0 · a\n'), null)
  })
  it('names both versions when they differ', () => {
    assert.match(versionProblem('{"version":"0.2.0"}', '## v0.1.0 · a\n'), /package.json is 0.2.0 but .* v0.1.0/)
  })
})

describe('check-links (D4)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qct-links-'))
  writeFileSync(join(dir, 'here.md'), 'x')
  const file = join(dir, 'README.md')
  it('ignores external links, anchors and code', () => {
    assert.deepEqual(deadLinks(file, '[a](https://x.y) [b](#top) [c](here.md#s) `[d](gone.md)`'), [])
  })
  it('reports a relative link to a missing file', () => {
    assert.deepEqual(deadLinks(file, '[a](gone.md) [b](here.md)'), ['gone.md'])
  })
})
