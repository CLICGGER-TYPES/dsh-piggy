// @ts-check
/** Device-local proxy preferences shared by game, extensions and shell downloads. */
import { readFileSync, writeFileSync, renameSync, mkdirSync, rmSync } from 'node:fs'
import { CHANNEL } from './channel.js'
import { isIP } from 'node:net'
import { dirname } from 'node:path'

const MODES = ['system', 'direct', 'http', 'socks5']
const DEFAULT = Object.freeze({ mode: 'system', address: '' })

/** Accept one proxy endpoint, never a PAC script, bypass rule or embedded credential. */
export function proxyPreference(value) {
  if (!value || !MODES.includes(value.mode)) throw new Error('请选择有效的代理模式')
  if (value.mode === 'system' || value.mode === 'direct') return { mode: value.mode, address: '' }
  const input = String(value.address ?? '').trim()
  if (!input) throw new Error('请填写代理地址和端口')
  const url = new URL(input.includes('://') ? input : `${value.mode}://${input}`)
  if (url.protocol !== `${value.mode}:` || !url.hostname || url.username || url.password ||
      (url.pathname && url.pathname !== '/') || url.search || url.hash) throw new Error('请填写主机和端口，不含账号、路径或代理规则')
  if (!/^[a-z0-9._-]+$/i.test(url.hostname) && !isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error('代理主机名无效')
  // URL removes HTTP's default port; an explicit :80 remains a valid endpoint.
  const port = url.port || (value.mode === 'http' && /:80$/.test(input) ? '80' : '')
  if (!port || !/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('代理端口应在 1–65535 之间')
  return { mode: value.mode, address: `${url.hostname}:${Number(port)}` }
}

export function proxyConfig(preference) {
  if (preference.mode === 'system' || preference.mode === 'direct') return { mode: preference.mode }
  return { mode: 'fixed_servers', proxyRules: `${preference.mode}://${preference.address}` }
}

/** The updater has its own Electron session; configuring only defaultSession misses it. */
export function createProxy({ path, sessions }) {
  /** @type {{ mode: string, address: string }} */
  let current = { ...DEFAULT }
  let warning = ''
  try { current = proxyPreference(JSON.parse(readFileSync(path, 'utf8'))) }
  catch (error) { if (error?.code !== 'ENOENT') warning = '代理配置无法读取，暂时跟随系统；请重新应用或清除配置' }
  let busy = false
  const apply = async value => {
    for (const session of sessions) await session.setProxy(proxyConfig(value))
    for (const session of sessions) await session.closeAllConnections()
  }
  async function set(value, clear = false) {
    if (busy) return { ok: false, reason: '正在应用代理设置' }
    busy = true
    try {
      const next = clear ? { ...DEFAULT } : proxyPreference(value)
      try {
        await apply(next)
        if (clear) rmSync(path, { force: true })
        else {
          mkdirSync(dirname(path), { recursive: true })
          writeFileSync(path + '.tmp', JSON.stringify(next) + '\n', { mode: 0o600 })
          renameSync(path + '.tmp', path)
        }
      } catch (error) {
        await apply(current)
        throw error
      }
      current = next
      warning = ''
      return { ok: true, preference: { ...current } }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) }
    } finally { busy = false }
  }
  async function test() {
    try {
      const url = CHANNEL.registry
      const route = await sessions[0].resolveProxy(url)
      const response = await sessions[0].fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await response.arrayBuffer()
      return { ok: true, route }
    } catch (error) { return { ok: false, reason: error instanceof Error ? error.message : String(error) } }
  }
  return { get: () => ({ ...current, ...(warning ? { warning } : {}) }), init: () => apply(current), set, clear: () => set(DEFAULT, true), test }
}
