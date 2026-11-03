// @ts-check
/** 只允许面板为当前 OwnerDocument 显式开关服务并生成单猪邀请。 */
import { isAbsolute } from 'node:path'

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u

function sameSelection(config, active) {
  return config !== null && active !== null && config.ownerDocumentPath === active.ownerDocumentPath &&
    config.ownerId === active.ownerId && config.pigId === active.pigId
}

/** @param {{getHost:()=>any,getOwnerConfig:()=>any,isSupported:()=>boolean,selectionStore:any,isQuitting:()=>boolean,log:(...args:any[])=>void}} deps */
export function createOwnerNetworkManager(deps) {
  function context() {
    if (deps.isQuitting()) throw new Error('应用正在关闭')
    const config = deps.getOwnerConfig()
    if (config?.source === 'task') throw new Error('隔离运行模式不能开启本机网络会话')
    if (!config || typeof config.ownerDocumentPath !== 'string' || !isAbsolute(config.ownerDocumentPath) ||
        typeof config.ownerId !== 'string' || !ID.test(config.ownerId) || typeof config.pigId !== 'string' || !ID.test(config.pigId)) {
      throw new Error('请先建立或选择一份本机完整存档')
    }
    if (!deps.isSupported()) throw new Error('当前游戏包不支持 owner LAN 会话')
    const selection = deps.selectionStore.read()
    if (selection.pending !== null || !sameSelection(config, selection.active)) throw new Error('当前存档选择需要先恢复或重新启动')
    const host = deps.getHost()
    if (host === null || typeof host.ownerLanStatus !== 'function' || typeof host.startOwnerLan !== 'function' ||
        typeof host.createOwnerLanInvitation !== 'function' || typeof host.stopOwnerLan !== 'function') {
      throw new Error('当前游戏宿主暂不支持 owner LAN 会话')
    }
    return { config, host }
  }

  async function status() {
    try {
      const { config, host } = context()
      const service = await host.ownerLanStatus()
      return { ok: true, available: true, ownerId: config.ownerId, pigId: config.pigId, ...service }
    } catch (error) {
      return { ok: true, available: false, running: false,
        reason: error instanceof Error ? error.message : '本机网络会话暂不可用' }
    }
  }

  async function start(options = {}) {
    let current
    try { current = context() }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '本机网络会话暂不可用' } }
    try { return { ok: true, ...(await current.host.startOwnerLan({ listenAddress: options.listenAddress })) } }
    catch (error) {
      const reason = error instanceof Error ? error.message : '本机网络会话启动失败'
      deps.log('owner LAN start refused', reason)
      return { ok: false, reason }
    }
  }

  async function invite(pigId) {
    let current
    try { current = context() }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '本机网络会话暂不可用' } }
    if (typeof pigId !== 'string' || !ID.test(pigId)) return { ok: false, reason: '小猪选择无效' }
    try {
      const status = await current.host.ownerLanStatus()
      if (status?.running !== true) return { ok: false, reason: '请先显式开启本机 LAN 会话' }
      const roster = await current.host.listOwnerPigs()
      if (roster?.ownerId !== current.config.ownerId || !Array.isArray(roster.pigs) ||
          !roster.pigs.some(pig => pig?.pigId === pigId)) return { ok: false, reason: '所选小猪不属于当前完整存档' }
      // 邀请只返回给可信面板调用方，不写入磁盘或日志。
      return { ok: true, ...(await current.host.createOwnerLanInvitation(pigId)) }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : '无法创建一次性邀请' }
    }
  }

  async function stop() {
    let current
    try { current = context() }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '本机网络会话暂不可用' } }
    try { return { ok: true, ...(await current.host.stopOwnerLan()) } }
    catch (error) { return { ok: false, reason: error instanceof Error ? error.message : '本机网络会话停止失败' } }
  }

  return Object.freeze({ status, start, invite, stop })
}
