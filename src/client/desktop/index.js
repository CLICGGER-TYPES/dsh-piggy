// @ts-check
/** Desktop entry facade: preserve the loader contract while assigning pet state per controller. */
import { createPetController } from './pet-controller.js'
import { installPanel, startPanel } from './panel-window.js'
import { installExt } from './ext-window.js'
import { DESKTOP_CSS } from './css.js'

/** Page ↔ desktop-shell protocol; geometry changes do not add a shell capability. */
export const DESKTOP_VERSION = 6

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
      petController = createPetController({
        shell,
        documentObject: document,
        windowObject: window,
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
