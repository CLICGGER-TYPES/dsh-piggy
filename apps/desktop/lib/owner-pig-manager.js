// @ts-check
/** Panel-only local owner roster operations; no renderer-provided path or owner identity. */
import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function safeReason(error, fallback) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('当前') || message.startsWith('所选存档') || message.startsWith('已有存档')) return message
  return fallback
}

/** @param {any} config @param {any} active */
function sameSelection(config, active) {
  return config !== null && active !== null &&
    config.ownerDocumentPath === active.ownerDocumentPath && config.ownerId === active.ownerId && config.pigId === active.pigId
}

/**
 * @param {{getHost:()=>any,getOwnerConfig:()=>any,isSupported:()=>boolean,selectionStore:any,lifecycle:any,isQuitting:()=>boolean,log:(...args:any[])=>void}} deps
 */
export function createOwnerPigManager(deps) {
  function currentContext() {
    if (deps.isQuitting()) throw new Error('应用正在关闭')
    const config = deps.getOwnerConfig()
    if (config?.source === 'task') throw new Error('隔离运行模式不能更改本机小猪选择')
    if (!config || typeof config.ownerDocumentPath !== 'string' || !isAbsolute(config.ownerDocumentPath) ||
        typeof config.ownerId !== 'string' || !ID_PATTERN.test(config.ownerId) ||
        typeof config.pigId !== 'string' || !ID_PATTERN.test(config.pigId)) {
      throw new Error('请先建立或选择一份本机完整存档')
    }
    if (!deps.isSupported()) throw new Error('当前游戏版本不支持本机多猪管理')
    const selection = deps.selectionStore.read()
    if (selection.pending !== null) throw new Error('已有存档切换需要先恢复')
    if (!sameSelection(config, selection.active)) throw new Error('当前小猪选择与运行中的宿主不一致，请重新启动后再试')
    const host = deps.getHost()
    if (!host || typeof host.listOwnerPigs !== 'function' || typeof host.createOwnerPig !== 'function') {
      throw new Error('当前游戏宿主尚未提供多猪服务')
    }
    return { config, host }
  }

  function status() {
    try {
      const { config, host } = currentContext()
      return { ok: true, available: true, mode: 'owner', activePigId: config.pigId, hostReady: host !== null }
    } catch (error) {
      return { ok: true, available: false, mode: deps.getOwnerConfig() ? 'owner' : 'legacy',
        reason: safeReason(error, '本机多猪管理暂不可用') }
    }
  }

  async function list() {
    let context
    try { context = currentContext() }
    catch (error) { return { ok: false, reason: safeReason(error, '本机多猪管理暂不可用') } }
    try {
      const roster = await context.host.listOwnerPigs()
      if (roster === null || typeof roster !== 'object' || roster.ownerId !== context.config.ownerId ||
          !Array.isArray(roster.pigs) || roster.pigs.length < 1) {
        return { ok: false, reason: '当前完整存档的猪列表无法验证' }
      }
      const seen = new Set()
      const pigs = []
      for (const pig of roster.pigs) {
        if (pig === null || typeof pig !== 'object' || typeof pig.pigId !== 'string' || !ID_PATTERN.test(pig.pigId) ||
            seen.has(pig.pigId) || typeof pig.name !== 'string' || typeof pig.hatched !== 'boolean' || typeof pig.dead !== 'boolean') {
          return { ok: false, reason: '当前完整存档的猪列表无法验证' }
        }
        seen.add(pig.pigId)
        pigs.push({ pigId: pig.pigId, name: pig.name, hatched: pig.hatched, dead: pig.dead,
          stage: typeof pig.stage === 'string' ? pig.stage : null,
          activity: typeof pig.activity === 'string' ? pig.activity : null,
          selected: pig.pigId === context.config.pigId })
      }
      if (!seen.has(context.config.pigId)) return { ok: false, reason: '当前选择的小猪已不在完整存档中' }
      return { ok: true, pigs }
    } catch (error) {
      deps.log('owner pig roster failed', safeReason(error, '当前完整存档的猪列表读取失败'))
      return { ok: false, reason: safeReason(error, '当前完整存档的猪列表读取失败') }
    }
  }

  async function scheduleSelection(context, pigId, actionName) {
    const action = deps.lifecycle.reserveAction(actionName)
    if (action === null) return { ok: false, reason: '另一个操作正在进行' }
    try {
      await deps.lifecycle.requireSavedGame()
      const current = currentContext()
      if (!sameSelection(current.config, context.config)) throw new Error('当前小猪选择已变化，请重试')
      deps.selectionStore.stage({
        ownerDocumentPath: current.config.ownerDocumentPath,
        ownerId: current.config.ownerId,
        pigId,
      })
      setImmediate(() => {
        void deps.lifecycle.restartGame().catch(async error => {
          try { deps.selectionStore.rollbackPending() } catch (rollbackError) {
            deps.log('owner pig selection rollback failed', safeReason(rollbackError, '无法恢复之前的小猪选择'))
          }
          try { await deps.lifecycle.recoverAction(error) }
          catch (recoveryError) { deps.log('owner pig restart recovery failed', safeReason(recoveryError, '宿主恢复失败')) }
        }).finally(() => deps.lifecycle.releaseAction(action))
      })
      return { ok: true, restarting: true }
    } catch (error) {
      try { if (deps.selectionStore.read().pending !== null) deps.selectionStore.rollbackPending() } catch { /* keep the journal for startup recovery */ }
      if (deps.lifecycle.hostClosed) {
        try { await deps.lifecycle.recoverAction(error) } catch (recoveryError) {
          deps.log('owner pig recovery failed', safeReason(recoveryError, '宿主恢复失败'))
        }
      }
      deps.lifecycle.releaseAction(action)
      return { ok: false, reason: safeReason(error, '小猪选择未切换；当前存档保持不变') }
    }
  }

  async function select(pigId) {
    let context
    try { context = currentContext() }
    catch (error) { return { ok: false, reason: safeReason(error, '本机多猪管理暂不可用') } }
    if (typeof pigId !== 'string' || !ID_PATTERN.test(pigId)) return { ok: false, reason: '小猪选择无效' }
    if (pigId === context.config.pigId) return { ok: true, unchanged: true }
    const current = await list()
    if (current.ok !== true || !current.pigs.some(pig => pig.pigId === pigId)) {
      return { ok: false, reason: '所选小猪不属于当前本机完整存档' }
    }
    return scheduleSelection(context, pigId, 'owner-pig-switch')
  }

  async function addAndSelect() {
    let context
    try { context = currentContext() }
    catch (error) { return { ok: false, reason: safeReason(error, '本机多猪管理暂不可用') } }
    const action = deps.lifecycle.reserveAction('owner-pig-create')
    if (action === null) return { ok: false, reason: '另一个操作正在进行' }
    let pigId = null
    let created = false
    try {
      await deps.lifecycle.requireSavedGame()
      const current = currentContext()
      if (!sameSelection(current.config, context.config)) throw new Error('当前小猪选择已变化，请重试')
      // The renderer never chooses the new identity or its owner. The owner runtime
      // seeds an unhatched egg and projects only its pig-owned body before writing.
      pigId = randomUUID()
      const result = await current.host.createOwnerPig(pigId)
      if (result === null || typeof result !== 'object' || result.ownerId !== current.config.ownerId ||
          result.pig?.pigId !== pigId || result.pig?.hatched !== false) {
        throw new Error('新增小猪回读不匹配')
      }
      created = true
      deps.selectionStore.stage({ ownerDocumentPath: current.config.ownerDocumentPath, ownerId: current.config.ownerId, pigId })
      setImmediate(() => {
        void deps.lifecycle.restartGame().catch(async error => {
          try { deps.selectionStore.rollbackPending() } catch (rollbackError) {
            deps.log('owner pig selection rollback failed', safeReason(rollbackError, '无法恢复之前的小猪选择'))
          }
          try { await deps.lifecycle.recoverAction(error) }
          catch (recoveryError) { deps.log('owner pig restart recovery failed', safeReason(recoveryError, '宿主恢复失败')) }
        }).finally(() => deps.lifecycle.releaseAction(action))
      })
      return { ok: true, pigId, restarting: true }
    } catch (error) {
      try { if (deps.selectionStore.read().pending !== null) deps.selectionStore.rollbackPending() } catch { /* keep the journal for startup recovery */ }
      if (deps.lifecycle.hostClosed) {
        try { await deps.lifecycle.recoverAction(error) } catch (recoveryError) {
          deps.log('owner pig recovery failed', safeReason(recoveryError, '宿主恢复失败'))
        }
      }
      deps.lifecycle.releaseAction(action)
      if (created && pigId !== null) {
        return { ok: false, pigCreated: true, pigId, reason: '新小猪已保存到当前完整存档，但切换未完成；原小猪仍在使用' }
      }
      return { ok: false, reason: safeReason(error, '新增小猪失败；当前存档保持不变') }
    }
  }

  return { status, list, select, addAndSelect }
}
