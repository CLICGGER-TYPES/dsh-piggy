// @ts-check
/** 面板贴猪的位置计算：猪可见框、气泡扩展、选边和 niri 避让。 */
import {
  PANEL_FALLBACK, PANEL_GAP, PANEL_MIN_HEIGHT, panelAnchorFor, panelBoundsClearOfPig, panelBoundsFor,
  panelReferenceFor, panelViewportSize, pigScreenBox,
} from './panel-geometry.js'

/**
 * @param {{
 *   screen: any,
 *   readBounds: (pet: any) => { x: number, y: number, width: number, height: number },
 *   niriEnabled: boolean,
 *   workAreaAt?: (point: {x:number,y:number}) => {x:number,y:number,width:number,height:number},
 *   workAreas?: () => Array<{x:number,y:number,width:number,height:number}>,
 * }} deps
 */
export function createPanelPlacement(deps) {
  /** niri 用输出的逻辑工作区；其它平台保持 Electron 的 workArea。 */
  function workAreaAt(point) {
    if (typeof deps.workAreaAt === 'function') return deps.workAreaAt(point)
    return deps.screen.getDisplayNearestPoint(point).workArea
  }
  /** 猪窗口的真实/虚拟屏幕位置：niri 下由 surface 提供，GNOME/Windows 仍是 getBounds。 */
  function readPetBounds(pet) {
    return typeof deps.readBounds === 'function' ? deps.readBounds(pet) : pet.window.getBounds()
  }

  function pigOnScreen(pet, friendAnchor) {
    if (friendAnchor !== null) return friendAnchor
    if (pet === null || pet.window === null || pet.window.isDestroyed() || pet.panelPig === null) return null
    const pig = pet.panelPigVisible ?? pet.panelPig
    return pigScreenBox(pet.petAsked, readPetBounds(pet), pig,
      pet.dragSession !== null ? { dragging: true, slide: pet.lastDragSlide } : {})
  }

  function referenceOnScreen(pet, friendAnchor) {
    if (friendAnchor !== null) return friendAnchor
    const pig = pigOnScreen(pet, friendAnchor)
    if (pig === null || pet === null || pet.window === null || pet.window.isDestroyed() || pet.panelSpeech === null) return pig
    const speech = pigScreenBox(pet.petAsked, readPetBounds(pet), pet.panelSpeech,
      pet.dragSession !== null ? { dragging: true, slide: pet.lastDragSlide } : {})
    return panelReferenceFor(pig, speech)
  }

  function decideAnchor(pet, friendAnchor, size, keep) {
    const pig = referenceOnScreen(pet, friendAnchor)
    if (pig === null) return null
    return panelAnchorFor(pig, workAreaAt({
      x: Math.round(pig.x + pig.width / 2), y: Math.round(pig.y + pig.height / 2),
    }), size?.width ?? PANEL_FALLBACK.width, keep)
  }

  function bounds(pet, friendAnchor, anchor, size, fixed) {
    const pig = referenceOnScreen(pet, friendAnchor)
    if (pig === null || anchor === null) return null
    const dragAreas = pet?.dragSession !== null && pet?.dragSession !== undefined
      ? (typeof deps.workAreas === 'function' ? deps.workAreas()
        : deps.screen.getAllDisplays().map(display => display.workArea)) : null
    const viewport = panelViewportSize(anchor, size, fixed)
    // 面板高度不能超过这一侧真正空出来的地方：否则 panelBoundsFor 会把它夹回屏幕里，
    // 结果又压在猪身上（用户右键猪时「面板挡住整只猪」）。
    let fitted = viewport
    if (viewport !== null) {
      const area = anchor.area
      const room = anchor.vertical === 'above'
        ? pig.y - area.y
        : area.y + area.height - (pig.y + pig.height)
      const maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.floor(room - PANEL_GAP))
      if (viewport.height > maxHeight) fitted = { ...viewport, height: maxHeight }
    }
    const next = panelBoundsFor(pig, anchor, fitted, dragAreas)
    // niri 的屏幕工作区不含 Noctalia 顶栏；面板被夹回边缘时可能压住猪，四个方向里换一个。
    // 多留 4px：页面报的 panelPig 和实时 DOM 会有几像素动画差，保证视觉上仍至少隔 PANEL_GAP。
    if (!deps.niriEnabled) return next
    return panelBoundsClearOfPig(next, pig, anchor.area, PANEL_GAP + 4)
  }

  return { pigOnScreen, referenceOnScreen, decideAnchor, bounds }
}
