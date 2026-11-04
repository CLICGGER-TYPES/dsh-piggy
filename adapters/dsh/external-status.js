// @ts-check
/**
 * 外部控制器的只读状态视图：连接摘要、设置卡片状态与最后快照摘要。
 *
 * 只读取调用方传入的当前状态，不写配置、不发网络请求、不改控制器字段；
 * 配置写入、发现和合并生命周期仍在 external-controller.js。
 *
 * @module dsh-piggy/adapters/dsh/external-status
 */
import { mergeSummary } from '../../core.js'
import { readStateFile } from '../../store/state-file.js'

/** 摘要是否一样：只比紧凑摘要里的字段，变了才写配置，别每 4 秒写一次盘。 */
export function sameSummary(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  return a.name === b.name && a.level === b.level && a.days === b.days && a.coins === b.coins &&
    a.items === b.items && a.badges === b.badges && a.dead === b.dead && a.hatched === b.hatched && a.box === b.box
}

/**
 * 建立状态视图。`state()` 每次返回控制器当下的字段，视图不缓存，避免面板
 * 4 秒重绘时读到旧连接/旧预览。
 * @param {object} input
 * @param {string} input.statePath
 * @param {() => number} input.now
 * @param {{ status: () => { queued: number, bytes: number, dropped: any } }} input.outbox
 * @param {() => { mode: string, connection: string, target: any, error: any, config: any,
 *   configCorrupt: boolean, preview: any, lastAt: any, lastSnapshot: any }} input.state
 */
export function createStatusView({ statePath, now, outbox, state }) {
  function link() {
    const current = state()
    const snapshot = current.lastSnapshot
    // merged/dead 是只读展示字段：顶部标签据此区分「已合并」和「桌面猪已离开」。
    const summary = snapshot?.pig?.dead === true ? { dead: true } : (current.target?.summary ?? null)
    return {
      state: current.mode === 'normal' ? 'connected' : current.connection,
      lastAt: current.lastAt,
      queued: outbox.status().queued,
      merged: current.config?.pigState === 'merged',
      dead: summary?.dead === true || snapshot?.dead === true,
    }
  }

  function snapshotsSummary() {
    try {
      const state = readStateFile(statePath, now()).state
      return state === null ? null : mergeSummary(state)
    } catch { return null }
  }

  function status() {
    const current = state()
    const { mode, connection, target, error, config, configCorrupt, preview, lastAt } = current
    const snapshot = current.lastSnapshot
    const queue = outbox.status()
    const localSummary = config?.localSummary ?? (mode === 'normal' ? snapshotsSummary() : null)
    const desktop = target === null ? { found: false, running: true, enabled: false, reason: error ?? '', appVersion: '', gameVersion: '', stateVersion: 0, mergeRulesVersion: 0, pid: 0 } : {
      found: true, running: true, enabled: true, reason: error ?? '',
      appVersion: target.appVersion ?? '', gameVersion: target.gameVersion ?? '',
      stateVersion: target.stateVersion ?? 0, mergeRulesVersion: target.mergeRulesVersion ?? 0, pid: target.pid ?? 0,
    }
    return {
      ok: true,
      mode: mode === 'normal' ? 'embedded' : 'external',
      pigState: config?.pigState ?? 'none',
      connection: mode === 'normal' ? 'embedded' : connection,
      clientId: config?.clientId ?? null,
      target: target === null ? (config?.target ?? null) : { ...target, enabled: target.enabled ?? true, reason: error ?? '' },
      desktop,
      source: { summary: localSummary, hasPig: localSummary !== null },
      lastSummary: config?.lastSummary ?? snapshot?.pig ?? null,
      queued: queue.queued,
      queueBytes: queue.bytes,
      dropped: queue.dropped,
      lastAt,
      error: error ?? (configCorrupt ? 'config-corrupt' : null),
      preview: preview === null ? null : { mergeId: preview.mergeId, expiresAt: preview.expiresAt },
      mergeId: config?.mergeId ?? preview?.mergeId ?? null,
      can: {
        connect: mode === 'normal',
        merge: mode === 'normal' || config?.pigState === 'paused',
        rollback: config?.pigState === 'merged',
        restoreEmbedded: config?.pigState === 'merged',
        act: mode === 'external' && connection === 'connected',
      },
      merged: config?.pigState === 'merged',
      canMerge: mode === 'normal' || config?.pigState === 'paused',
      canRollback: config?.pigState === 'merged',
      canRecoverInternal: config?.pigState === 'merged',
      canAct: mode === 'external' && connection === 'connected',
      configCorrupt,
      retirementPending: config?.retirementPending === true,
    }
  }

  return { link, status, snapshotsSummary }
}
