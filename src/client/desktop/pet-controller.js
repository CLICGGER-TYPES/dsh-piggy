// @ts-check
/** Own one pet renderer's shell adapter and lifecycle. */
import { bodyVisualBounds } from './visual-bounds.js'
import { createFlightBridge } from './flight-bridge.js'
import { createInputController } from './input-controller.js'
import { createLayoutController } from './layout-controller.js'
import { suppressNativeTooltips } from './tooltips.js'

/**
 * @param {{shell:any, documentObject:Document, windowObject:Window, getHost:()=>any,
 *   pigId?:string|null, primary?:boolean, slot?:number|null}} deps
 */
export function createPetController(deps) {
  const shell = deps.shell
  const pigId = typeof deps.pigId === 'string' ? deps.pigId : null
  const primary = pigId !== null && deps.primary === true
  let dragSlide = { x: 0, y: 0 }
  let flying = false
  let installed = false
  let started = false
  let installing = false
  let starting = false
  let geometrySubscribed = false
  let dragSlideSubscribed = false
  let geometryAsked = false
  let adapterInstalled = false
  let tooltipsInstalled = false
  let observerInstalled = false
  let resizeListenerInstalled = false
  let pointerupListenerInstalled = false
  let intervalId = null

  function host() { return deps.getHost() }
  function dragging() {
    const scene = host()?.querySelector('.dp-scene')
    // Pressing keeps the old held appearance; only a started window drag owns geometry.
    return scene != null && scene.getAttribute('data-window-dragging') === 'true'
  }

  const input = createInputController({
    shell,
    documentObject: deps.documentObject,
    windowObject: deps.windowObject,
    getHost: host,
    blocked: () => dragging() || flying,
    trackingBlocked: dragging,
    leaveBlocked: dragging,
  })
  const layout = createLayoutController({
    shell,
    windowObject: deps.windowObject,
    getHost: host,
    isDragging: dragging,
    isFlying: () => flying,
    setHitRects: input.setHitRects,
    pigId,
    primary,
    slot: deps.slot,
  })

  const flight = createFlightBridge({
    shell,
    readGeometry: layout.readGeometry,
    pigInWindow: layout.pigInWindow,
    rehome: layout.rehome,
    setFlying: on => { flying = on },
    isFlying: () => flying,
    clearSlide: slide => {
      dragSlide = { x: 0, y: 0 }
      layout.commit(host(), slide)
    },
    forgetLayout: layout.forget,
    tick: layout.tick,
  })

  function install() {
    if (installed || installing) return
    installing = true
    try {
      if (!geometrySubscribed && typeof shell.onGeometry === 'function') {
        shell.onGeometry(() => layout.schedule())
        geometrySubscribed = true
      }
      if (!dragSlideSubscribed && typeof shell.onDragSlide === 'function') {
        shell.onDragSlide(slide => {
          // Ignore the late slide event after release; release has already synchronously read geometry.
          if (!dragging()) return
          dragSlide = { x: Number(slide?.x) || 0, y: Number(slide?.y) || 0 }
          const root = host()
          if (root !== null) root.style.translate = dragSlide.x === 0 && dragSlide.y === 0
            ? '' : dragSlide.x + 'px ' + dragSlide.y + 'px'
        })
        dragSlideSubscribed = true
      }
      if (!geometryAsked && typeof shell.askGeometry === 'function') {
        shell.askGeometry()
        geometryAsked = true
      }

      if (!adapterInstalled) {
        const adapter = {
          role: 'pet',
          /** 多猪：这个宠物窗口自己的身份；旧外壳/单猪时 pigId 是 null，不暴露 multiPig。 */
          pigId,
          primary,
          ...(pigId !== null ? { multiPig: true } : {}),
          proxy: shell.proxy,
          cloudSave: shell.cloudSave,
          saves: shell.saves,
          ownerArchives: shell.ownerArchives,
          ext: shell.ext,
          fullscreen: shell.fullscreen,
          external: shell.external ?? null,
          split: true,
          onRecover: shell.onRecover,
          recoverHome(foot) {
            const info = layout.readGeometry()
            const areas = info?.workAreas ?? (info?.workArea ? [info.workArea] : [])
            layout.recover(foot, areas)
            flying = false
            dragSlide = { x: 0, y: 0 }
            layout.forget()
            layout.commit(host(), dragSlide)
            layout.tick()
          },
          dragVisualBounds: shell.dragVisualBounds === true,
          onStateChanged: shell.onStateChanged,
          panel: {
            toggle(open) {
              const info = layout.readGeometry()
              const pig = info && info.window ? layout.pigInWindow(info.window) : null
              shell.panel.toggle(open, pig === null ? null : { x: pig.x, y: pig.y, width: pig.width, height: pig.height })
            },
            on: shell.panel.on,
            onFx: shell.panel.onFx,
            raisePet: shell.panel.raisePet,
          },
          beginDrag(origin) {
            const info = layout.readGeometry()
            const pig = info && info.window ? layout.pigInWindow(info.window) : null
            dragSlide = { x: 0, y: 0 }
            if (typeof shell.beginDrag !== 'function') return
            shell.beginDrag(pig === null ? null : {
              x: pig.x,
              y: pig.y,
              width: pig.width,
              height: pig.height,
              visual: bodyVisualBounds(pig),
              slide: typeof shell.onDragSlide === 'function',
              origin: origin !== null && origin !== undefined && Number.isFinite(origin.x) && Number.isFinite(origin.y)
                ? { x: origin.x, y: origin.y } : undefined,
            })
          },
          dragHeartbeat() {
            if (typeof shell.dragHeartbeat === 'function') shell.dragHeartbeat()
          },
          endDrag(release) {
            if (typeof shell.endDrag !== 'function') return
            shell.endDrag(release ?? null)
            // Preserve the existing IPC barrier: read the final native bounds only after endDrag.
            const info = layout.readGeometry()
            if (info && info.window) {
              if (info.dragSlide && Number.isFinite(info.dragSlide.x) && Number.isFinite(info.dragSlide.y)) {
                dragSlide = info.dragSlide
              }
              const inWindow = layout.pigInWindow(info.window)
              const pig = inWindow === null ? null : {
                ...inWindow, x: inWindow.x + dragSlide.x, y: inWindow.y + dragSlide.y,
              }
              if (pig !== null) layout.rehome(info.window, pig, info.workAreas ?? [info.workArea])
            }
            layout.commit(host(), dragSlide)
            dragSlide = { x: 0, y: 0 }
            layout.forget()
            layout.schedule()
          },
          syncGeometry() { layout.tick() },
          flight,
          moveBy: typeof shell.moveBy === 'function' ? function (dx, dy) {
            shell.moveBy(dx, dy)
            const info = layout.readGeometry()
            const pig = info && info.window ? layout.pigInWindow(info.window) : null
            if (pig !== null) layout.rehome(info.window, pig, info.workAreas ?? [info.workArea])
          } : undefined,
        }
        ;/** @type {any} */ (deps.windowObject).__dshPiggyShell = adapter
        adapterInstalled = true
      }
      if (!tooltipsInstalled) {
        suppressNativeTooltips(deps.documentObject)
        tooltipsInstalled = true
      }
      input.install()
      installed = true
    } finally {
      installing = false
    }
  }

  function start() {
    if (!installed || started || starting) return
    starting = true
    try {
      const root = host()
      const MutationObserverClass = /** @type {any} */ (deps.windowObject).MutationObserver
      if (!observerInstalled && root !== null && typeof MutationObserverClass === 'function') {
        new MutationObserverClass(layout.schedule).observe(root, {
          subtree: true, childList: true, attributes: true, characterData: true,
        })
        observerInstalled = true
      }
      if (!resizeListenerInstalled) {
        deps.windowObject.addEventListener('resize', layout.schedule)
        resizeListenerInstalled = true
      }
      if (!pointerupListenerInstalled) {
        deps.windowObject.addEventListener('pointerup', layout.schedule)
        pointerupListenerInstalled = true
      }
      if (intervalId === null) {
        const setIntervalForWindow = deps.windowObject.setInterval?.bind(deps.windowObject) ?? setInterval
        intervalId = setIntervalForWindow(function () {
          if (!dragging() && !flying) layout.tick()
        }, 1000)
      }
      input.startTracking()
      layout.tick()
      started = true
    } finally {
      starting = false
    }
  }

  return { install, start }
}
