// @ts-check
/**
 * 启动模式选择（纯函数，不碰 Electron）。
 *
 * 契约：
 * - 默认是原有的双窗口外壳（split）。
 * - 只认完整参数：`--window-mode=stage`、`--window-mode=split`，以及兼容写法 `--stage`。
 *   子串、其他插件的参数（例如 `--enable-features=stage`）、`--stage=1` 一律不参与。
 * - 只要出现明确的 `--window-mode=...`，以最后一个为准；bare `--stage` 只在没有明确
 *   `--window-mode` 时生效。这样包装脚本追加 `--stage` 不会覆盖用户明确要求的 split。
 * - 同一模式的重复参数没有额外含义；未识别参数不改变默认值。
 *
 * @module dsh-piggy-desktop/lib/window-mode
 */

/** 默认入口：双窗口（猪 + 面板）。 */
export const DEFAULT_WINDOW_MODE = 'split'

/** 可选的启动模式。 */
export const WINDOW_MODES = Object.freeze(['split', 'stage'])

const WINDOW_MODE_RE = /^--window-mode=(split|stage)$/
const STAGE_ARG = '--stage'

/**
 * 从启动参数里选出窗口模式。
 * @param {readonly string[]} [argv] 一般是 `process.argv.slice(1)`；非字符串项会被忽略。
 * @returns {'split' | 'stage'}
 */
export function selectWindowMode(argv = []) {
  let explicitMode = null
  let bareStage = false

  for (const arg of argv) {
    if (typeof arg !== 'string') continue
    if (arg === STAGE_ARG) {
      bareStage = true
      continue
    }
    const match = WINDOW_MODE_RE.exec(arg)
    if (match !== null) explicitMode = /** @type {'split' | 'stage'} */ (match[1])
  }

  if (explicitMode !== null) return explicitMode
  return bareStage ? 'stage' : DEFAULT_WINDOW_MODE
}
