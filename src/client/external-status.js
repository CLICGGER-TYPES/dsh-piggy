// @ts-check
/**
 * 外部桌宠状态读取：卡片和向导共用。
 *
 * 失败保留旧状态、只更新错误；不把「读不到」当成「桌面版没了」。
 * @module dsh-piggy/client/external-status
 */
import { fetchStatus } from './external-api.js'

/** 读状态：失败保留旧状态，只更新错误，不把卡片清成「未知」。 */
export async function loadStatus(session) {
  if (session.loading) return null
  session.loading = true
  try {
    const result = await fetchStatus()
    session.status = result.status
    session.lastLoad = Date.now()
    if (!result.ok) session.error = result.error?.code ?? 'network'
    else if (session.error === 'network' || session.error === 'timeout') session.error = ''
    return session.status
  } finally {
    session.loading = false
  }
}

export function ensureStatus(session) {
  if (session.loading) return
  if (session.status === null || Date.now() - session.lastLoad > 5000) {
    loadStatus(session).then(() => session.ui?.renderContent?.()).catch(() => { session.ui?.renderContent?.() })
  }
}

