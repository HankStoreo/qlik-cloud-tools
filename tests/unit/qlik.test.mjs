import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createQlik, nextPage, queryArgs } from '../../src/qlik.mjs'

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

  it('follows every next link and sends its cursor back as given', () => {
    const seen = []
    const answers = [
      { data: [1, 2], links: { next: { href: 'https://tenant.example/api/v1/reloads?limit=2&next=abc' } } },
      { data: [3], links: { next: { href: '/api/v1/reloads?limit=2&next=def' } } },
      { data: [4], links: { self: { href: 'x' } } },
    ]
    const qlik = createQlik({
      context: 'c',
      exec: (_f, a) => {
        seen.push(a.slice(2).join(' '))
        return JSON.stringify(answers[seen.length - 1])
      },
    })
    assert.deepEqual(qlik.all('v1/reloads', { limit: '2' }), [1, 2, 3, 4])
    assert.deepEqual(seen, [
      'raw get v1/reloads --raw --query limit=2',
      'raw get v1/reloads --raw --query limit=2 --query next=abc',
      'raw get v1/reloads --raw --query limit=2 --query next=def',
    ])
  })
  it('reads a bare array or an empty page as the last page', () => {
    assert.deepEqual(createQlik({ context: 'c', exec: () => '[5]' }).all('x'), [5])
    assert.deepEqual(createQlik({ context: 'c', exec: () => '{}' }).all('x'), [])
  })
  it('stops with an error when a next link repeats', () => {
    const page = JSON.stringify({ data: [1], links: { next: { href: '/api/x?page=2' } } })
    assert.throws(() => createQlik({ context: 'c', exec: () => page }).all('x'), /next-page link repeats after 2 pages/)
  })
  it('quotes a query value that holds a comma or a quote', () => {
    assert.deepEqual(queryArgs({ limit: '5', sort: 'name,-id', q: 'a"b' }), [
      '--query',
      'limit=5',
      '--query',
      '"sort=name,-id"',
      '--query',
      '"q=a""b"',
    ])
  })
  it('turns a next link into a path after /api/ and its query', () => {
    assert.deepEqual(nextPage('https://tenant.example/api/scheduling/tasks?limit=100&page=2&sort=-updatedAt'), {
      path: 'scheduling/tasks',
      query: { limit: '100', page: '2', sort: '-updatedAt' },
    })
    assert.deepEqual(nextPage('v1/items?next=x%3D%3D'), { path: 'v1/items', query: { next: 'x==' } })
  })
})
