// @ts-check
/**
 * 轮询/动作遇到「宿主正在处理存档」。
 *
 * 等待原生合并确认时（最长 60 秒）运行时在 exclusive 里，普通 GET /state、
 * POST /act 会被 503 拒绝，正文是「正在处理存档，请稍后重试」。这不是断线：
 * 面板必须保留当前快照、不弹「连接不上宿主」、也不把这份错误正文当快照画上去；
 * 真正的 503 故障（存档恢复失败）仍然按失败处理，不能被顺手吞掉。
 *
 * 直接跑 src/client/io.js（构建产物 client.js 由 root 统一生成），网络用假 fetch。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg, migrate } from '../core.js'
import { createGameRuntime } from '../runtime/index.js'
import { createIo } from '../src/client/io.js'

const SNAPSHOT = { ok: true, hatched: true, dead: false, pig: { name: '团团', coins: 494 }, link: { state: 'connected' } }
/** runtime/index.js 的 available() 在 exclusive 里给的话术。 */
const BUSY = { status: 503, ok: false, body: { ok: false, error: '正在处理存档，请稍后重试' } }
/** 同一个 503 状态码，但它说的是「存档坏了」，是真故障。 */
const FAULT = { status: 503, ok: false, body: { ok: false, error: '存档恢复未完成，请检查磁盘后重新启动' } }
/** 外层面板在桌面忙时给的占位正文：没有 pig，不是快照。 */
const BUSY_STUB = { status: 200, ok: true, body: { ok: false, reason: 'desktop-busy' } }

function element() {
  return {
    textContent: '',
    attrs: /** @type {Record<string, string>} */ ({}),
    getAttribute(name) { return this.attrs[name] ?? null },
    querySelector() { return null },
  }
}

/** 轮询最短路径要的上下文；render 返回 true，等于「真的画了」。 */
function context() {
  const ctx = {
    view: JSON.parse(JSON.stringify(SNAPSHOT)),
    busy: false,
    stopped: false,
    justBought: null,
    bubbles: /** @type {string[]} */ ([]),
    rendered: /** @type {any[]} */ ([]),
    flashes: /** @type {string[]} */ ([]),
    reactions: /** @type {string[]} */ ([]),
    pomoHint: element(),
    content: element(),
    showBubble(text) { this.bubbles.push(text) },
    render(next) { this.rendered.push(next); return true },
    flash(action) { this.flashes.push(action) },
    react(kind) { this.reactions.push(kind) },
    fitPanel() {},
  }
  return { ctx, io: createIo(ctx) }
}

/** 按顺序回放准备好的回应；用完就抛错，免得测试悄悄多发一次请求。 */
function serve(responses) {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options?.method ?? 'GET' })
    const next = responses.shift()
    if (next === undefined) throw new Error('no response queued for ' + url)
    return { ok: next.ok, status: next.status, json: async () => next.body }
  }
  return calls
}

function windowStub() {
  const old = globalThis.window
  globalThis.window = { setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {} }
  return () => { globalThis.window = old }
}

test('轮询遇到「正在处理存档」的 503：保留快照，不报断线，也不画错误正文', async () => {
  const restore = windowStub()
  try {
    serve([BUSY, { status: 200, ok: true, body: SNAPSHOT }])
    const { ctx, io } = context()
    const before = ctx.view
    await io.refresh()
    assert.deepEqual(ctx.bubbles, [], '忙碌不是断线，不能弹「连接不上宿主」')
    assert.equal(ctx.rendered.length, 0, '503 的错误正文不能当快照画上去')
    assert.equal(ctx.view, before, '当前快照原样保留')
    assert.equal(ctx.view.pig.coins, 494)
    // 同一轮轮询的下一次照常画：忙碌没有把轮询弄坏。
    await io.refresh()
    assert.equal(ctx.rendered.length, 1)
    assert.equal(ctx.rendered[0].pig.coins, 494)
    assert.deepEqual(ctx.bubbles, [])
  } finally { restore() }
})

test('真正的 503 故障仍然按断线处理：不吞、不画', async () => {
  const restore = windowStub()
  try {
    serve([FAULT])
    const { ctx, io } = context()
    await io.refresh()
    assert.deepEqual(ctx.bubbles, ['连接不上宿主'])
    assert.equal(ctx.rendered.length, 0)
  } finally { restore() }
})

test('外层面板「桌面忙」的占位正文（200、没有快照）不清空面板', async () => {
  const restore = windowStub()
  try {
    serve([BUSY_STUB])
    const { ctx, io } = context()
    await io.refresh()
    assert.deepEqual(ctx.bubbles, [])
    assert.equal(ctx.rendered.length, 0, '没有 pig 的正文不是快照')
    assert.equal(ctx.view.pig.name, '团团')
  } finally { restore() }
})

test('动作遇到「正在处理存档」：不执行、不画，只提示稍后再试', async () => {
  const restore = windowStub()
  try {
    serve([BUSY, { status: 200, ok: true, body: SNAPSHOT }])
    const { ctx, io } = context()
    const result = await io.send('feed')
    assert.equal(result, null, '忙碌时动作没有执行，不能回一份「成功」')
    assert.deepEqual(ctx.bubbles, ['宿主正忙，请稍后再试'])
    assert.equal(ctx.rendered.length, 0)
    assert.equal(ctx.busy, false, '失败后要把面板放开')
    // 宿主闲下来以后动作照旧。
    const later = await io.send('feed')
    assert.equal(later?.ok, true)
    assert.equal(ctx.rendered.length, 1)
  } finally { restore() }
})

test('真实运行时的 exclusive 503：轮询不当断线，桌面仍给最后一份快照', async () => {
  const restore = windowStub()
  const dir = mkdtempSync(join(tmpdir(), 'piggy-io-busy-'))
  const statePath = join(dir, 'state.json')
  writeFileSync(statePath, JSON.stringify(migrate(hatchEgg(1_800_000_000_000), 1_800_000_000_000)))
  const runtime = createGameRuntime({ statePath, now: () => 1_800_000_000_000 })
  try {
    // 模拟「等原生合并确认」：exclusive 一直拿着，普通 GET /state 只能得到 503。
    let release = null
    const holding = runtime.exclusive(async () => { await new Promise(resolve => { release = resolve }) })
    const out = await runtime.handle('GET', '/dsh-piggy/state')
    assert.equal(out.status, 503)
    const body = JSON.parse(String(out.body))
    assert.match(body.error, /正在处理存档/)

    serve([{ status: 503, ok: false, body }])
    const { ctx, io } = context()
    await io.refresh()
    assert.deepEqual(ctx.bubbles, [], '真实运行时的忙碌 503 也不能弹「连接不上宿主」')
    assert.equal(ctx.rendered.length, 0)

    // 桌面侧给面板的最后一份快照还在（/pair/state 走 view()，忙时返回上一份）。
    assert.equal(runtime.view(false).pig.name, '猪猪', '忙时桌面侧仍然给最后一份快照')
    while (release === null) await new Promise(resolve => setImmediate(resolve))
    release()
    await holding
  } finally {
    try { runtime.dispose() } catch { /* 已关就算了 */ }
    rmSync(dir, { recursive: true, force: true })
    restore()
  }
})
