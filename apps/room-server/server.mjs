// @ts-check
/**
 * dsh-piggy 独立房间服务器。
 *
 * 一个进程托管一个内存房间，不依赖 Electron / 桌面版；房间只同步外观、位置、
 * 表情，不读写存档。默认持久房间：玩家进出不会关闭，SIGINT/SIGTERM 才停。
 *
 * 用法：
 *   node apps/room-server/server.mjs --public-url https://piggy.example.com
 *   node apps/room-server/server.mjs --public-url http://203.0.113.8:47824 \
 *     --listen 0.0.0.0 --port 47824 --allow-public
 *   node apps/room-server/server.mjs --public-url https://piggy.example.com:8443 \
 *     --listen 0.0.0.0 --port 8443 --tls-cert cert.pem --tls-key key.pem --allow-public
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { generateRoomCode, normalizeRoomCode } from '../desktop/lib/room-code.js'
import { startRoomServer } from '../desktop/lib/room-server.js'

const HELP = `dsh-piggy 独立房间服务器

用法：
  node apps/room-server/server.mjs [参数]

参数：
  --listen <地址>        监听地址，默认 127.0.0.1（交给反代时保持默认）
  --port <端口>          监听端口，默认 47824；0 表示随机
  --code <房间码>         固定 4 位房间码；不填则每次启动随机生成
  --public-url <URL>     对外地址，例如 https://piggy.example.com
                         或 http://203.0.113.8:47824
  --tls-cert <文件>      直接提供 HTTPS 证书（与 --tls-key 一起）
  --tls-key <文件>       直接提供 HTTPS 私钥
  --allow-public         监听 0.0.0.0 或公网 IP 时必须显式打开
  --trust-proxy          采信反向代理的 X-Forwarded-Host（HTTPS 反代默认开启）
  --no-persistent        最后一位玩家离开后关闭房间（默认不关）
  -h, --help             显示帮助

示例：
  # 域名 + Caddy/Nginx 反代（推荐）
  node apps/room-server/server.mjs --public-url https://piggy.example.com

  # 公网 IP + HTTP 直连（只建议测试）
  node apps/room-server/server.mjs --public-url http://203.0.113.8:47824 \\
    --listen 0.0.0.0 --port 47824 --allow-public

  # 直接 HTTPS（不用反代）
  node apps/room-server/server.mjs --public-url https://piggy.example.com:8443 \\
    --listen 0.0.0.0 --port 8443 --tls-cert cert.pem --tls-key key.pem --allow-public
`

const DEFAULTS = {
  listen: '127.0.0.1',
  port: 47824,
  code: '',
  publicUrl: '',
  tlsCert: '',
  tlsKey: '',
  allowPublic: false,
  trustProxy: false,
  persistent: true,
  help: false,
}

/** @param {string[]} argv */
export function parseArgs(argv) {
  const out = { ...DEFAULTS }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = () => {
      if (index + 1 >= argv.length) throw new Error(`${arg} 需要一个值`)
      index += 1
      return argv[index]
    }
    if (arg === '--help' || arg === '-h') out.help = true
    else if (arg === '--listen') out.listen = value()
    else if (arg === '--port') out.port = Number(value())
    else if (arg === '--code') out.code = value()
    else if (arg === '--public-url') out.publicUrl = value()
    else if (arg === '--tls-cert') out.tlsCert = value()
    else if (arg === '--tls-key') out.tlsKey = value()
    else if (arg === '--allow-public') out.allowPublic = true
    else if (arg === '--trust-proxy') out.trustProxy = true
    else if (arg === '--no-persistent') out.persistent = false
    else throw new Error(`未知参数：${arg}`)
  }
  return out
}

/** @param {string} raw */
function parsePublicUrl(raw) {
  if (raw === '') return null
  let url
  try { url = new URL(raw) } catch { throw new Error('--public-url 不是合法 URL') }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '' ||
      (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('--public-url 只能写 http(s)://主机[:端口]/，不能带路径、账号或查询')
  }
  return {
    protocol: url.protocol === 'https:' ? 'https' : 'http',
    host: url.hostname,
    port: url.port === '' ? (url.protocol === 'https:' ? 443 : 80) : Number(url.port),
    origin: url.origin,
  }
}

/** @param {ReturnType<typeof parseArgs>} args */
function validate(args) {
  if (!Number.isSafeInteger(args.port) || args.port < 0 || args.port > 65535) throw new Error('--port 必须在 0–65535')
  if (args.listen === '') throw new Error('--listen 不能为空')
  if ((args.tlsCert === '') !== (args.tlsKey === '')) throw new Error('--tls-cert 和 --tls-key 必须一起提供')
  const publicUrl = parsePublicUrl(args.publicUrl)
  if (args.listen === '0.0.0.0' && publicUrl === null) {
    throw new Error('监听 0.0.0.0 时需要 --public-url，告诉客户端该连哪个地址')
  }
  if (args.listen === '0.0.0.0' && args.allowPublic !== true) {
    throw new Error('监听 0.0.0.0 是公网暴露，必须显式加 --allow-public')
  }
  if (publicUrl?.protocol === 'https' && args.tlsCert === '' && args.listen !== '127.0.0.1' && args.listen !== 'localhost') {
    throw new Error('HTTPS 公网地址没有 TLS 证书时，只能监听 127.0.0.1 交给反向代理')
  }
  if (publicUrl?.protocol === 'http' && args.tlsCert !== '') {
    throw new Error('HTTP 公网地址不能同时配 TLS 证书')
  }
  return { publicUrl }
}

/** @param {ReturnType<typeof parseArgs>} args */
async function main(args) {
  if (args.help) {
    process.stdout.write(HELP)
    return
  }
  const { publicUrl } = validate(args)
  const tls = args.tlsCert === ''
    ? null
    : { cert: readFileSync(args.tlsCert), key: readFileSync(args.tlsKey) }
  const code = args.code === '' ? generateRoomCode() : normalizeRoomCode(args.code)
  if (code === null) throw new Error('--code 无效，应为 4 位，例如 7K2M')
  const advertisedHost = publicUrl?.host ?? (args.listen === '0.0.0.0' ? '' : args.listen)
  if (advertisedHost === '') throw new Error('需要 --public-url 或具体的 --listen 地址')
  const advertisedPort = publicUrl?.port ?? args.port
  const trustProxy = args.trustProxy || (publicUrl?.protocol === 'https' && tls === null)
  const server = await startRoomServer({
    code,
    listenAddress: args.listen,
    port: args.port,
    advertisedHost,
    advertisedPort,
    allowPublic: args.allowPublic,
    trustProxy,
    persistent: args.persistent,
    tls,
    log: (...parts) => console.log(new Date().toISOString(), '[room]', ...parts),
  })
  const status = server.status()
  const origin = publicUrl?.origin ?? `${status.protocol}://${advertisedHost}:${status.port}`
  const invite = `${origin.replace(/\/$/u, '')}/#PIG-${code}`
  console.log(JSON.stringify({
    ok: true,
    code: `PIG-${code}`,
    invite,
    listen: `${args.listen}:${status.port}`,
    publicUrl: publicUrl?.origin ?? null,
    protocol: status.protocol,
    persistent: args.persistent,
    tls: tls !== null,
  }))
  let closing = false
  const close = async () => {
    if (closing) return
    closing = true
    try { await server.close() } catch { /* already closed */ }
    process.exit(0)
  }
  process.on('SIGINT', close)
  process.on('SIGTERM', close)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(parseArgs(process.argv.slice(2))).catch(error => {
    console.error('room-server:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
