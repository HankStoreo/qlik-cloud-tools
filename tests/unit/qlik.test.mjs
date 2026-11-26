import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createQlik } from '../../src/qlik.mjs'

describe('createQlik', () => {
  it('runs every call against the named context', () => {
    const seen = []
    const qlik = createQlik({
      context: 'demo',
      bin: 'qlik',
      exec: (f, a) => {
        seen.push([f, ...a])
        return '[]'
      },
    })
    qlik.list('space', 'ls')
    assert.deepEqual(seen, [['qlik', '--context', 'demo', 'space', 'ls']])
  })
  it('reads a bare array, a { data } page, or neither, as a list', () => {
    const answer = (out) => createQlik({ context: 'c', exec: () => out })
    assert.deepEqual(answer('[1,2]').list('x'), [1, 2])
    assert.deepEqual(answer('{"data":[3],"links":{}}').list('x'), [3])
    assert.deepEqual(answer('{"id":"a"}').list('x'), [])
  })
  it('says which call failed, with the first line of its error', () => {
    const qlik = createQlik({
      context: 'c',
      exec: () => {
        throw Object.assign(new Error('exit 1'), { stderr: 'Error: unauthorized\nmore' })
      },
    })
    assert.throws(() => qlik.json('space', 'ls'), /qlik space ls failed: Error: unauthorized$/)
  })
  it('says when qlik-cli is missing', () => {
    const qlik = createQlik({
      context: 'c',
      bin: 'nope',
      exec: () => {
        throw Object.assign(new Error('spawn nope ENOENT'), { code: 'ENOENT' })
      },
    })
    assert.throws(() => qlik.run('space', 'ls'), /qlik-cli not found \(tried "nope"\)/)
  })
  it('rejects output that is not JSON', () => {
    assert.throws(() => createQlik({ context: 'c', exec: () => 'oops' }).json('x'), /did not return JSON/)
  })
})
