// @ts-check
/**
 * HTTP 路由：面板读的快照、面板发的动作，以及手绘精灵图。
 *
 * 路由只做分发与序列化，不算业务规则 —— 每个动作都转发给 store（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/routes
 */
import { readFileSync } from 'node:fs'

import { PACKAGE_VERSION, snapshot } from './snapshot.js'
import { extensionForAction } from './core.js'
import { customSkinArt, installSkinPack } from './store/skin-pack.js'
import { createExtRuntime } from './store/ext-runtime.js'

const STATE_ROUTE = '/dsh-piggy/state'
const ACT_ROUTE = '/dsh-piggy/act'
const ART_ROUTE = '/dsh-piggy/art'
const BODY_LIMIT_BYTES = 2048
const SKIN_ROUTE = '/dsh-piggy/skins/import'
// 网页版自带的 emoji 字体（assets/piggy-emoji.woff2）：很多机器的系统 emoji 缺字或长得不一样。
const EMOJI_ROUTE = '/dsh-piggy/emoji.woff2'
const SKIN_LIMIT_BYTES = 2 * 1024 * 1024
// 设置 → 日志：导出这一份，和浏览器那半边送上来的日志。
const LOG_EXPORT_ROUTE = '/dsh-piggy/logs/export'
const LOG_CLIENT_ROUTE = '/dsh-piggy/logs/client'
const LOG_LIMIT_BYTES = 256 * 1024

const str = value => (typeof value === 'string' ? value : '')

function sendJson(res, status, body, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...extra })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req) {
  let text = ''
  for await (const chunk of req) {
    text += chunk
    if (text.length > BODY_LIMIT_BYTES) return null
  }
  if (text.trim() === '') return {}
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

async function readBuffer(req, limit) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Every operation the panel can invoke. One table means the HTTP route and the
 * slash command cannot drift apart.
 */
const OPERATIONS = {
  hatch: store => ({ ok: true, hatched: store.hatch() }),
  adopt: store => ({ ok: store.adopt(), adopted: true }),
  reset: store => ({ ok: store.reset(), reset: true }),
  dev: (store, body) => ({ ok: store.dev(body.patch ?? {}), dev: true }),
  ageFromNow: store => ({ ok: store.ageFromNow(), ageFromNow: true }),
  timeScale: (store, body) => ({ ok: store.setTimeScale(body.scale), timeScale: true }),
  // The three care actions spend an item; `item` says which one.
  feed: (store, body) => store.act('feed', str(body.item)),
  bathe: (store, body) => store.act('bathe', str(body.item)),
  play: (store, body) => store.act('play', str(body.item)),
  pet: (store, body) => store.act('pet', str(body.part)),
  // Answer the pig's latest line: `line` is the message id, `index` the button.
  reply: (store, body) => store.reply(Number(body.line), Number(body.index)),
  // 日常：签到（在线礼包在 B5 的第二步接上）。
  signIn: store => store.signIn(),
  // C2 番茄钟：开一个（分钟数由客户端给 15/25/45）／放弃当前这个。
  pomodoro: (store, body) => store.startPomodoro(Number(body.minutes)),
  pomodoroAbandon: store => store.abandonPomodoro(),
  openGift: store => store.openGift(),
  // 扩展中心：打开 / 关闭一个扩展。
  // v0.30：删除 / 安装扩展、下载扩展自己的动作（见 docs/design/extension-download.md）。
  removeExtension: (store, body) => store.ext.remove(str(body.key)),
  installExtension: (store, body) => store.ext.install(str(body.key)),
  ext: (store, body) => store.ext.act(str(body.key), str(body.op), body.data !== null && typeof body.data === 'object' ? body.data : {}),
  setExtension: (store, body) => store.setExtension(str(body.key), body.on === true),
  // The panel's timers ask the pig to speak up; the pig decides whether to.
  chat: (store, body) => store.chat(str(body.reason)),
  quiet: (store, body) => store.setQuiet(body.on === true),
  owner: (store, body) => store.setOwnerName(str(body.name)),
  // 居民卡: the catchphrase and the motto.
  catchphrase: (store, body) => store.setCatchphrase(str(body.text)),
  motto: (store, body) => store.setMotto(str(body.text)),
  // 加冕: `form` picks which one (empty = the first).
  crown: (store, body) => store.crown(str(body.form)),
  // 改猪的名字（和斜杠命令 /pig name 同一条路）。
  name: (store, body) => ({ ok: Boolean(store.rename(str(body.name))), name: true }),
  work: (store, body) => store.startWork(str(body.job)),
  study: (store, body) => store.startStudy(str(body.subject), str(body.stage)),
  interest: (store, body) => store.startInterest(str(body.interest)),
  trip: (store, body) => store.startTrip(str(body.trip)),
  fishCast: (store, body) => store.castFishing(Number(body.power), str(body.bait)),
  fishHook: store => store.hookFishing(),
  fishResolve: (store, body) => store.resolveFishing(body.success === true),
  fishKeep: store => store.keepFish(),
  fishFeed: (store, body) => store.feedFish(str(body.id)),
  fishSell: (store, body) => store.sellFish(str(body.id)),
  exchange: (store, body) => store.exchange(str(body.key), str(body.direction), Number(body.amount)),
  fishAuto: (store, body) => store.startAutoFishing(Number(body.minutes), str(body.bait)),
  fishGive: (store, body) => store.grantFish(str(body.fish)),
  fishSkip: store => store.skipFishingWait(),
  skin: (store, body) => store.selectSkin(str(body.skin)),
  calloff: store => store.callOffActivity(),
  buy: (store, body) => store.buy(str(body.item)),
  use: (store, body) => store.useItem(str(body.item)),
  doctor: store => store.seeDoctor(),
  // Souvenirs are the only thing the pig can sell back.
  sell: (store, body) => store.sellSouvenir(str(body.souvenir)),
  // 家当: put a dress item on / take it off.
  wear: (store, body) => store.wear(str(body.item), body.on !== false),
  // Debug: one of everything.
  giveAll: store => store.grantAll(),
}

/** GET /dsh-piggy/state — the one shape the panel reads. */
function registerStateRoute(webServer, store) {
  return webServer.register({
    kind: 'exact',
    path: STATE_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
      try {
        sendJson(res, 200, snapshot(store), { 'cache-control': 'no-store' })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}

/**
 * GET /dsh-piggy/art/<name>.svg, <name>-sleep.png or feedback/<name>.png.
 *
 * Serving them from the package keeps the art as real .svg files in the
 * repository rather than a blob embedded in the client bundle.
 */
function registerArtRoute(webServer, store) {
  return webServer.register({
    kind: 'prefix',
    path: ART_ROUTE,
    handler: (req, res) => {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
      const raw = String(req.url ?? '').split('?')[0]
      const name = raw.startsWith(ART_ROUTE + '/') ? raw.slice(ART_ROUTE.length + 1) : ''
      // Only the files this package ships: a fixed, boring name pattern, so
      // nothing from the request can ever walk out of ./assets.
      if (!/^(?:[a-z][a-z0-9-]{0,63}(?:\.svg|-sleep\.png)|feedback\/[a-z][a-z0-9-]{0,63}\.png)$/.test(name)) return sendJson(res, 404, { error: 'not found' })
      try {
        const custom = name.endsWith('.svg') && name.startsWith('custom-') ? customSkinArt(store.filePath, name) : null
        const art = custom ?? readFileSync(new URL('./assets/' + name, import.meta.url))
        // 自带立绘可以缓存一小时：摸猪、喂食时立绘来回换，每次都重新取会空一帧（猪闪一下）。
        // 自定义皮肤玩家随时会换，仍然每次都问。
        res.writeHead(200, { 'content-type': name.endsWith('.png') ? 'image/png' : 'image/svg+xml; charset=utf-8', 'cache-control': custom === null ? 'max-age=3600' : 'no-cache' })
        res.end(art)
      } catch (error) {
        console.warn(`[dsh-piggy] sprite missing: name="${name}" reason="${error instanceof Error ? error.message : String(error)}"`)
        sendJson(res, 404, { error: 'not found' })
      }
    },
  })
}

function registerSkinRoute(webServer, store) {
  return webServer.register({
    kind: 'exact', path: SKIN_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' })
      // 收原始 ZIP（老客户端、DSH 网页）或 base64 文本（新客户端；桌面版的本地协议会把二进制当文本读坏）。
      const raw = await readBuffer(req, Math.ceil(SKIN_LIMIT_BYTES * 1.4))
      if (raw === null) return sendJson(res, 413, { ok: false, reason: 'too-large', errors: ['ZIP 不能超过 2 MB'] })
      const zip = raw[0] === 0x50 && raw[1] === 0x4b ? raw : Buffer.from(raw.toString('ascii').trim(), 'base64')
      if (zip.length > SKIN_LIMIT_BYTES) return sendJson(res, 413, { ok: false, reason: 'too-large', errors: ['ZIP 不能超过 2 MB'] })
      if (zip[0] !== 0x50 || zip[1] !== 0x4b) return sendJson(res, 400, { ok: false, reason: 'invalid-pack', errors: ['这不是 ZIP 文件'] })
      try {
        const result = installSkinPack(store.filePath, zip)
        if (!result.ok || result.metadata === undefined) return sendJson(res, 400, { ok: false, reason: 'invalid-pack', errors: result.errors })
        const metadata = result.metadata
        const selected = store.registerCustomSkin(metadata)
        sendJson(res, selected.ok === false ? 400 : 200, { ...snapshot(store), ok: selected.ok !== false, imported: metadata.key })
      } catch (error) {
        sendJson(res, 400, { ok: false, reason: 'invalid-pack', errors: [error instanceof Error ? error.message : String(error)] })
      }
    },
  })
}

/**
 * POST /dsh-piggy/act — one action from the panel.
 *
 * The operation's verdict must win over the snapshot's always-true `ok`:
 * spreading the snapshot last silently swallowed every refusal.
 */
function registerActRoute(webServer, store) {
  return webServer.register({
    kind: 'exact',
    path: ACT_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' })
      const body = await readJsonBody(req)
      if (body === null) return sendJson(res, 413, { error: 'body too large or not JSON' })
      const operation = typeof body.action === 'string' ? body.action : ''
      const found = Object.hasOwn(OPERATIONS, operation) ? OPERATIONS[operation] : null
      // 关掉的扩展的动作一律拒绝（扩展中心，见 docs/design/extension-center.md）。
      const owner = extensionForAction(operation)
      const run = found !== null && owner !== null && typeof store.extensionOn === 'function' && !store.extensionOn(owner.key)
        ? () => ({ ok: false, reason: 'extension-off' }) : found
      if (run === null) {
        return sendJson(res, 400, { error: `unknown action "${operation}"`, allowed: Object.keys(OPERATIONS) })
      }
      // A throwing operation must answer, not take the route down with it: an
      // unhandled error here would leave the panel polling a dead handler.
      const startedAt = Date.now()
      try {
        const result = await run(store, body)
        // 每个动作都记一条：用户说「这个按钮不行」时，导出日志里能看到点过什么、结果如何。
        if (typeof store.journal?.record === 'function') {
          const ok = result.ok !== false
          store.journal.record(ok ? 'info' : 'warn', 'act', `${operation} ${ok ? 'ok' : 'refused'}`, {
            ms: Date.now() - startedAt,
            reason: ok ? '' : str(result.reason),
            message: ok ? '' : str(result.message),
            key: str(body.key),
            item: str(body.item),
          })
        }
        sendJson(res, 200, {
          ...snapshot(store),
          ok: result.ok !== false,
          reason: result.reason,
          wait: result.wait,
          price: result.price,
          reward: result.reward,
          missing: result.missing,
          sold: result.sold,
          need: result.need,
          have: result.have,
          message: result.message,
        }, { 'cache-control': 'no-store' })
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        console.warn(`[dsh-piggy] action failed: action="${operation}" reason="${detail}"`)
        store.journal?.record?.('error', 'act', `${operation} threw`, { ms: Date.now() - startedAt, reason: detail, stack: error instanceof Error ? error.stack : '' })
        sendJson(res, 500, { ok: false, reason: 'error' })
      }
    },
  })
}

/**
 * 扩展的两个 GET：在线目录（?force=1 重新读）和下载扩展的面板脚本。
 *   GET /dsh-piggy/extensions/online
 *   GET /dsh-piggy/ext/<key>/client.js
 */
function registerExtRoutes(webServer, store) {
  const offOnline = webServer.register({
    kind: 'exact', path: '/dsh-piggy/extensions/online',
    handler: async (req, res) => {
      try {
        const force = String(req.url ?? '').includes('force=1')
        sendJson(res, 200, await store.ext.onlineView(force), { 'cache-control': 'no-store' })
      } catch (error) {
        sendJson(res, 200, { error: error instanceof Error ? error.message : String(error), entries: [] })
      }
    },
  })
  const offScript = webServer.register({
    kind: 'prefix', path: '/dsh-piggy/ext',
    handler: async (req, res) => {
      const match = /^\/dsh-piggy\/ext\/([a-z0-9-]+)\/client\.js$/.exec(String(req.url ?? '').split('?')[0])
      const script = match === null ? null : store.ext.clientScript(match[1])
      if (script === null) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found') }
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' })
      res.end(script)
    },
  })
  return () => { offOnline(); offScript() }
}

/**
 * GET /dsh-piggy/emoji.woff2 — 网页版自带的那套 emoji 字体。
 *
 * 只发这一个固定文件名，请求里带什么都改不了它读哪个文件。
 * 缓存一小时（跟立绘一个策略）：字体跟着版本走，改一次最多一小时生效。
 */
function registerEmojiRoute(webServer) {
  return webServer.register({
    kind: 'exact', path: EMOJI_ROUTE,
    handler: (req, res) => {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
      try {
        const font = readFileSync(new URL('./assets/piggy-emoji.woff2', import.meta.url))
        res.writeHead(200, { 'content-type': 'font/woff2', 'cache-control': 'max-age=3600' })
        res.end(font)
      } catch (error) {
        console.warn(`[dsh-piggy] emoji font missing: reason="${error instanceof Error ? error.message : String(error)}"`)
        sendJson(res, 404, { error: 'not found' })
      }
    },
  })
}

/**
 * 日志的两条路由（设置 → 日志）：
 *   GET  /dsh-piggy/logs/export  — 导出这一份纯文本（客户端负责弹「另存为」）
 *   POST /dsh-piggy/logs/client  — 浏览器那半边的日志送进来，和宿主的一份合并
 */
function registerLogRoutes(webServer, store) {
  const offExport = webServer.register({
    kind: 'exact', path: LOG_EXPORT_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'method not allowed; use GET' }, { allow: 'GET' })
      const journal = store.journal
      if (journal === undefined || typeof journal.text !== 'function') {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
        return res.end('这台宿主没有开日志。\n')
      }
      // 先把文件写到盘上，再导出：导出文件的最后几行不能缺。
      await journal.flush()
      res.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': 'attachment; filename="dsh-piggy-log.txt"',
      })
      res.end(journal.text(store.journalMeta ?? {}))
    },
  })
  const offClient = webServer.register({
    kind: 'exact', path: LOG_CLIENT_ROUTE,
    handler: async (req, res) => {
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'method not allowed; use POST' }, { allow: 'POST' })
      const buffer = await readBuffer(req, LOG_LIMIT_BYTES)
      if (buffer === null) return sendJson(res, 413, { error: 'body too large' })
      const journal = store.journal
      if (journal === undefined || typeof journal.attachClient !== 'function') return sendJson(res, 200, { ok: true, added: 0 })
      try {
        const parsed = JSON.parse(buffer.toString('utf8'))
        const added = journal.attachClient(parsed?.entries)
        return sendJson(res, 200, { ok: true, added })
      } catch (error) {
        return sendJson(res, 400, { ok: false, reason: 'invalid-json', message: error instanceof Error ? error.message : String(error) })
      }
    },
  })
  return () => { offExport(); offClient() }
}

/**
 * Register the three routes once the web seam exists.
 *
 * `ctx.inject` waits for the service instead of sampling it. The previous
 * version read `ctx.get('webServer')` at apply time and bailed out when it was
 * undefined — which is exactly what happened during profile activation, so the
 * routes were never registered and the panel polled a 404 forever. A silent
 * optionality guard is not the same thing as a tolerant one: this one still
 * degrades on a host with no web seam, but only *after* the service has
 * actually been waited for.
 */
export function registerRoutes(ctx, store) {
  if (store.ext === undefined) store.ext = createExtRuntime(store, { gameVersion: PACKAGE_VERSION })
  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.webServer
    if (webServer === undefined) return () => {}
    const disposers = []
    try {
      disposers.push(registerStateRoute(webServer, store))
      disposers.push(registerArtRoute(webServer, store))
      disposers.push(registerSkinRoute(webServer, store))
      disposers.push(registerActRoute(webServer, store))
      disposers.push(registerExtRoutes(webServer, store))
      disposers.push(registerLogRoutes(webServer, store))
      disposers.push(registerEmojiRoute(webServer))
    } catch (error) {
      // A route already taken: the pig stays command-only rather than breaking
      // activation, but this is a real failure and should be visible.
      console.warn(`[dsh-piggy] 路由注册失败，猪只能用命令访问：${error instanceof Error ? error.message : String(error)}`)
    }
    return () => { for (const dispose of disposers) { try { dispose() } catch { /* best effort */ } } }
  })
}
