// @ts-check
/** 最近投递 IPC：只给面板窗口，失败只回空列表，不把错误带到设置页。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { registerWorkSourcesIpc } from '../lib/ipc/work-sources.js'

function harness({ panel = true, host = null } = {}) {
  const handlers = new Map()
  const calls = []
  registerWorkSourcesIpc({
    ipcMain: { handle(name, handler) { handlers.set(name, handler) } },
    fromPanelOnly: event => event?.panel === true,
    getHost: () => { calls.push('getHost'); return host },
  })
  const call = (event, ...args) => handlers.get('piggy:work-event-sources')(event, ...args)
  return { handlers, calls, call, panel: { panel } }
}

const summary = {
  ok: true,
  sources: [
    { source: 'dsh', count: 42, lastAt: 1_800_000_000_000, types: { turn: 37, tool: 5 } },
    { source: 'opencode', count: 3, lastAt: 1_799_999_000_000, types: { message: 2, agentError: 1 } },
  ],
}

test('最近投递只读 IPC 只注册一个通道，非面板来源返回空且不碰运行时', async () => {
  let reads = 0
  const host = { workEventSources: async () => { reads += 1; return summary } }
  const f = harness({ host })

  assert.deepEqual([...f.handlers.keys()], ['piggy:work-event-sources'])
  assert.deepEqual(await f.call({ panel: false }), { ok: false, sources: [] })
  assert.equal(reads, 0)
  assert.deepEqual(f.calls, [], '非面板来源连 host 都不读')

  assert.deepEqual(await f.call({ panel: true }), summary)
  assert.equal(reads, 1)
})

test('旧运行时、worker 失败或坏返回值都收敛成空列表', async () => {
  const cases = [
    harness({ host: null }),
    harness({ host: {} }),
    harness({ host: { workEventSources: async () => { throw new Error('worker closed') } } }),
    harness({ host: { workEventSources: async () => ({ ok: false, sources: [{ source: 'leak', count: 1, lastAt: 1, types: {} }] }) } }),
    harness({ host: { workEventSources: async () => ({ ok: true, sources: 'not-an-array' }) } }),
  ]
  for (const f of cases) assert.deepEqual(await f.call({ panel: true }), { ok: false, sources: [] })

  const f = harness({ host: { workEventSources: async () => ({ ok: true, sources: [
    { source: 'dsh', count: 2, lastAt: 10, types: { turn: 1, broken: -1 } },
    { source: '', count: 1, lastAt: 10, types: {} },
    { source: 'bad', count: 0, lastAt: 10, types: {} },
    { source: 'bad-time', count: 1, lastAt: NaN, types: {} },
  ] }) } })
  assert.deepEqual(await f.call({ panel: true }), {
    ok: true,
    sources: [{ source: 'dsh', count: 2, lastAt: 10, types: { turn: 1 } }],
  })
})
