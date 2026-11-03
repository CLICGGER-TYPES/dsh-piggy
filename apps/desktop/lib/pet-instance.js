// @ts-check
/**
 * 每个宠物窗口一份运行状态。
 *
 * 外壳 0.6.8 之前这些字段都是 main.js 里的单例（petAsked / placedShape / dragSession …），
 * 多猪时会被几只猪互相覆盖。从 MULTIPIGWIN03 起：
 *   - createPetState() 只放数据，不碰 Electron；
 *   - createPetRegistry() 维护 pigId / webContents.id / session token 三种索引；
 *   - 面板、托盘、全屏、恢复仍只读主猪（primary）的实例。
 *
 * 这里的对象故意保持普通形状，方便测试里用假的 BrowserWindow 直接跑。
 */

/** 第一版最多同时开 4 只猪的窗口。 */
export const MAX_PIG_WINDOWS = 4

/**
 * @typedef {object} PetState
 * @property {string|null} pigId
 * @property {string|null} token
 * @property {boolean} primary
 * @property {boolean} multiPig
 * @property {any} window
 * @property {number|null} webContentsId
 * @property {any} owner
 * @property {any} resizeShape
 * @property {any} showGate
 * @property {any} petAsked
 * @property {any} savedPigScreen
 * @property {any[]} lastShape
 * @property {any[]} placedShape
 * @property {boolean} hasPlacedShape
 * @property {any[]|null} placedHitShape
 * @property {{x:number,y:number}} flightSlide
 * @property {{x:number,y:number}|null} lastFlightShapeSlide
 * @property {boolean} flightShapeActive
 * @property {boolean} dragShapeActive
 * @property {{x:number,y:number}|null} lastPigWindow
 * @property {{width:number,height:number}} lastPigSize
 * @property {{x:number,y:number}|null} restingPigScreen
 * @property {any} lastContent
 * @property {any} panelPig
 * @property {any} panelSpeech
 * @property {any} dragSession
 * @property {any} dragTimer
 * @property {any} dragStats
 * @property {{x:number,y:number}} lastDragSlide
 * @property {any} hitTimer
 * @property {boolean} passthroughHit
 * @property {boolean|null} passthroughForward
 * @property {'unknown'|'modern'|'legacy'} passthroughMode
 * @property {boolean} closing
 */

/**
 * @param {{pigId?:string|null, token?:string|null, primary?:boolean, multiPig?:boolean}} [identity]
 * @returns {PetState}
 */
export function createPetState(identity = {}) {
  return {
    pigId: typeof identity.pigId === 'string' ? identity.pigId : null,
    token: typeof identity.token === 'string' ? identity.token : null,
    primary: identity.primary === true,
    multiPig: identity.multiPig === true,
    window: null,
    webContentsId: null,
    owner: null,
    resizeShape: null,
    showGate: null,
    petAsked: null,
    savedPigScreen: null,
    lastShape: [],
    placedShape: [],
    hasPlacedShape: false,
    placedHitShape: null,
    flightSlide: { x: 0, y: 0 },
    lastFlightShapeSlide: null,
    flightShapeActive: false,
    dragShapeActive: false,
    lastPigWindow: null,
    lastPigSize: { width: 56, height: 56 },
    restingPigScreen: null,
    lastContent: null,
    panelPig: null,
    panelSpeech: null,
    dragSession: null,
    dragTimer: null,
    dragStats: null,
    lastDragSlide: { x: 0, y: 0 },
    hitTimer: null,
    passthroughHit: false,
    passthroughForward: null,
    passthroughMode: 'unknown',
    closing: false,
  }
}

/**
 * @typedef {object} PetRegistry
 * @property {(pet:any)=>any} add
 * @property {(pet:any)=>void} remove
 * @property {(pet:any)=>void} bindWindow
 * @property {()=>any[]} all
 * @property {()=>any} primary
 * @property {(sender:any)=>any} bySender
 * @property {(token:string|null|undefined)=>any} byToken
 * @property {(pigId:string|null|undefined)=>any} byPig
 * @property {()=>number} size
 * @property {(max?:number)=>boolean} canAdd
 */

/**
 * @param {{max?:number}} [options]
 * @returns {PetRegistry}
 */
export function createPetRegistry(options = {}) {
  const max = Number.isInteger(options.max) && options.max > 0 ? options.max : MAX_PIG_WINDOWS
  /** @type {any[]} */
  const list = []
  /** @type {Map<string, any>} */
  const byPigId = new Map()
  /** @type {Map<number, any>} */
  const byContents = new Map()
  /** @type {WeakMap<object, number>} */
  const boundIds = new WeakMap()
  /** @type {any} */
  let primary = null

  function add(pet) {
    if (pet === null || pet === undefined) return pet
    if (!list.includes(pet)) list.push(pet)
    if (typeof pet.pigId === 'string' && pet.pigId !== '') byPigId.set(pet.pigId, pet)
    if (Number.isInteger(pet.webContentsId)) bindWindow(pet)
    if (pet.primary === true) primary = pet
    return pet
  }

  function remove(pet) {
    const index = list.indexOf(pet)
    if (index >= 0) list.splice(index, 1)
    if (pet.pigId !== null && byPigId.get(pet.pigId) === pet) byPigId.delete(pet.pigId)
    const id = Number.isInteger(pet.webContentsId) ? pet.webContentsId : boundIds.get(pet)
    if (Number.isInteger(id) && byContents.get(id) === pet) byContents.delete(id)
    boundIds.delete(pet)
    if (primary === pet) primary = null
  }

  function bindWindow(pet) {
    const next = pet.webContentsId
    if (!Number.isInteger(next)) return
    const previous = boundIds.get(pet)
    if (Number.isInteger(previous) && previous !== next && byContents.get(previous) === pet) byContents.delete(previous)
    byContents.set(next, pet)
    boundIds.set(pet, next)
  }

  function bySender(sender) {
    const id = sender?.id
    return Number.isInteger(id) ? byContents.get(id) ?? null : null
  }

  function byToken(token) {
    if (typeof token !== 'string' || token === '') return null
    return list.find(pet => pet.token === token) ?? null
  }

  function byPig(pigId) {
    if (typeof pigId !== 'string' || pigId === '') return null
    return byPigId.get(pigId) ?? null
  }

  function all() {
    return list.slice()
  }

  function primaryPet() {
    return primary !== null && list.includes(primary) ? primary : null
  }

  return {
    add, remove, bindWindow, all, primary: primaryPet, bySender, byToken, byPig,
    size: () => list.length,
    canAdd: (limit = max) => list.length < limit,
  }
}
