// @ts-check
/** Desktop entry facade: preserve the loader contract while assigning pet state per controller. */
import { createPetController } from './pet-controller.js'
import { installPanel, startPanel } from './panel-window.js'
import { installExt } from './ext-window.js'
import { DESKTOP_CSS } from './css.js'

/** Page ↔ desktop-shell protocol; geometry changes do not add a shell capability. */
export const DESKTOP_VERSION = 7

/** Same whitelist as the owner document and preload: alphanumeric first, ._:- after, ≤128. */
const PIG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

/** Read the pet identity from the preload shell; old shells have no pigId and stay single-pig. */
function pigContext(shell) {
  const pigId = typeof shell?.pigId === 'string' && PIG_ID_PATTERN.test(shell.pigId) ? shell.pigId : null
  return { pigId, primary: pigId !== null && shell.primary === true }
}

/**
 * Every same-origin /dsh-piggy request from this window has to name its pig.
 * The shell also routes via the document Referer, but that depends on the
 * network stack keeping it; an explicit query survives proxies and future
 * Chromium referrer-policy changes. Old game packages never call this.
 * @param {string|null} pigId
 */
function scopeFetchToPig(pigId) {
  if (pigId === null || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  const scoped = /** @type {any} */ (window)
  if (scoped.__piggyFetchPig === pigId) return
  const original = window.fetch.bind(window)
  window.fetch = (input, init) => {
    try {
      const raw = typeof input === 'string' ? input : input instanceof Request ? input.url : input instanceof URL ? input.href : String(input)
      const url = new URL(raw, window.location.href)
      if (url.origin === window.location.origin && url.pathname.startsWith('/dsh-piggy/') && !url.searchParams.has('pig')) {
        url.searchParams.set('pig', pigId)
        if (input instanceof Request) return original(new Request(url.href, input), init)
        return original(url.href, init)
      }
    } catch { /* 非 URL / 相对路径异常：原样交给 fetch */ }
    return original(input, init)
  }
  scoped.__piggyFetchPig = pigId
}

let installed = false
let started = false
let installing = false
let starting = false
let contextWindow = null
let contextDocument = null
let contextShell = null
let role = /** @type {'pet'|'panel'|'ext'|null} */ (null)
let petController = null

function selectContext(shell) {
  const shellChanged = shell !== undefined && contextShell !== shell
  if (contextWindow === window && contextDocument === document && !shellChanged) return true
  if (installing || starting) return false
  contextWindow = window
  contextDocument = document
  if (shell !== undefined) contextShell = shell
  installed = false
  started = false
  role = null
  petController = null
  return true
}

function installStyle() {
  if (document.querySelector('[data-piggy-desktop-style]')) return
  const style = document.createElement('style')
  style.setAttribute('data-piggy-desktop-style', '')
  style.textContent = DESKTOP_CSS
  document.head.appendChild(style)
}

/** Called by renderer/loader.js before the game is mounted. Keep this signature stable. */
export function install(shell) {
  if (installing || !selectContext(shell) || installed) return
  installing = true
  try {
    const split = shell.panel !== undefined && typeof shell.panel.toggle === 'function'
    if (!split) {
      // The current game package requires split windows; the loader still preserves
      // renderer/shell.js for an older game package that has no desktop module.
      console.warn('[piggy-desktop] shell has no split windows（请把桌面程序更新到 0.6.0 以上）')
      ;/** @type {any} */ (window).__dshPiggyShellOutdated = true
      installed = true
      return
    }

    role = shell.role === 'panel' ? 'panel' : shell.role === 'ext' ? 'ext' : 'pet'
    if (role === 'ext') {
      installStyle()
      installExt(shell)
      installed = true
      return
    }
    if (role === 'panel') {
      installStyle()
      installPanel(shell)
      installed = true
      return
    }

    document.documentElement.setAttribute('data-piggy-role', 'pet')
    const missing = ['place', 'beginDrag', 'endDrag'].filter(name => typeof shell[name] !== 'function')
    if (missing.length > 0) {
      console.warn('[piggy-desktop] shell is too old, missing: ' + missing.join(', ') + '（请更新桌面程序）')
      ;/** @type {any} */ (window).__dshPiggyShellOutdated = true
    }
    if (petController === null) {
      const { pigId, primary } = pigContext(shell)
      scopeFetchToPig(pigId)
      petController = createPetController({
        shell,
        documentObject: document,
        windowObject: window,
        pigId,
        primary,
        // Compatibility getter for the existing single-pig page. New callers can
        // provide an instance-scoped root through createPetController directly.
        getHost: () => document.querySelector('[data-dsh-pig]'),
      })
    }
    installStyle()
    petController.install()
    installed = true
  } finally {
    installing = false
  }
}

/** Loader calls this once, after mount. Each role keeps its existing start path. */
export function start() {
  if (starting || !selectContext() || !installed || started) return
  starting = true
  try {
    if (role === 'panel') startPanel()
    else if (role !== 'ext') petController?.start()
    started = true
  } finally {
    starting = false
  }
}

export const desktop = { version: DESKTOP_VERSION, install, start }
