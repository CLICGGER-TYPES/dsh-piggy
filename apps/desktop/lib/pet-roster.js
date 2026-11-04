// @ts-check
/**
 * 启动时决定开一只还是多只猪窗口：能力 + roster > 1 + 全部 session 成功才启用，
 * 任一失败就回滚会话并退回单窗口。窗口创建仍由组合根传入。
 */

/** 和 owner document / preload 同一套 ID 白名单。 */
const PIG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/**
 * @param {{
 *   getOwnerDocumentConfig: () => any,
 *   isOwnerPigRuntimeSupported: () => boolean,
 *   getHost: () => any,
 *   pets: any,
 *   primaryPetState: any,
 *   pigSessions: Map<string, string>,
 *   createWindow: () => Promise<any>,
 *   createPigWindow: (pet: any) => Promise<any>,
 *   closePetSession: (pet: any) => void,
 *   createPetState: (options: any) => any,
 *   maxPigWindows: number,
 *   isQuitting: () => boolean,
 *   isMultiPigActive: () => boolean,
 *   setMultiPigActive: (value: boolean) => void,
 *   log: (...parts: any[]) => any,
 * }} deps
 */
export function createPetRoster(deps) {
  /** roster 只接受同一 owner 的合法 pigId，顺序保留。 */
  function rosterPigIds(roster) {
    const ownerDocumentConfig = deps.getOwnerDocumentConfig()
    if (roster === null || typeof roster !== 'object') return []
    if (typeof ownerDocumentConfig?.ownerId === 'string' && roster.ownerId !== ownerDocumentConfig.ownerId) return []
    if (!Array.isArray(roster.pigs)) return []
    return [...new Set(roster.pigs
      .map(pig => pig?.pigId)
      .filter(pigId => typeof pigId === 'string' && PIG_ID_PATTERN.test(pigId)))]
  }

  /**
   * 启动时决定开一只还是多只：
   *   - 只有 OWNER_PIG_RUNTIME_API_VERSION === 1 且同一 owner 的 roster > 1 才多窗口；
   *   - 主猪（owner 选择的那只）必须在前 4 只里；
   *   - 只要有一只 session 开不出来，就回滚全部并退回原来的单窗口。
   */
  async function createPetWindows() {
    const ownerDocumentConfig = deps.getOwnerDocumentConfig()
    const primaryId = typeof ownerDocumentConfig?.pigId === 'string' && PIG_ID_PATTERN.test(ownerDocumentConfig.pigId)
      ? ownerDocumentConfig.pigId : null
    let plan = []
    if (deps.isOwnerPigRuntimeSupported() && primaryId !== null) {
      try {
        const host = deps.getHost()
        const roster = await host.listOwnerPigs()
        const pigIds = rosterPigIds(roster)
        if (pigIds.length > 1 && pigIds.includes(primaryId)) {
          plan = [primaryId, ...pigIds.filter(pigId => pigId !== primaryId)].slice(0, deps.maxPigWindows)
        }
      } catch (error) {
        deps.log('multi-pig roster unavailable', String(error))
      }
    }
    if (plan.length > 1) {
      const opened = []
      try {
        for (const pigId of plan) {
          const session = await deps.getHost().openPigSession(pigId)
          if (session === null || typeof session.token !== 'string' || session.token === '' || session.pigId !== pigId) {
            throw new Error(`pig session mismatch for ${pigId}`)
          }
          opened.push({ pigId, token: session.token })
        }
      } catch (error) {
        deps.log('multi-pig session failed; falling back to one window', String(error))
        for (const item of opened) {
          try { await deps.getHost().closePigSession(item.token) } catch { /* 回滚失败只影响下一次启动 */ }
        }
        plan = []
      }
      if (plan.length > 1) {
        deps.setMultiPigActive(true)
        for (const item of opened) {
          const pet = item.pigId === primaryId ? deps.primaryPetState : deps.createPetState({})
          pet.pigId = item.pigId
          pet.token = item.token
          pet.primary = item.pigId === primaryId
          pet.multiPig = true
          deps.pigSessions.set(item.pigId, item.token)
          deps.pets.add(pet)
        }
        deps.log('multi-pig enabled', JSON.stringify({
          pigs: plan, max: deps.maxPigWindows, primary: primaryId,
          limits: ['panel:retarget-on-context-menu', 'tray:primary', 'fullscreen:primary-probe', 'recover:primary', 'second-instance:primary'],
        }))
      }
    }
    if (!deps.isMultiPigActive()) {
      deps.log('multi-pig disabled', JSON.stringify({ supported: deps.isOwnerPigRuntimeSupported(), owner: ownerDocumentConfig !== null, pigId: primaryId }))
    }
    await deps.createWindow()
    if (deps.isQuitting()) return
    for (const pet of deps.pets.all()) {
      if (pet === deps.primaryPetState) continue
      try { await deps.createPigWindow(pet) } catch (error) {
        deps.log('pet window failed', pet.pigId ?? 'legacy', String(error))
        deps.closePetSession(pet)
        deps.pets.remove(pet)
      }
    }
  }

  return { createPetWindows, rosterPigIds }
}
