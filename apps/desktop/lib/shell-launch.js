// @ts-check
/** 外壳重启与 Wayland → X11 的平台选择。 */

/**
 * @param {{
 *   app: any,
 *   spawnProcess: (...args: any[]) => any,
 *   platform: string,
 *   env: Record<string, string | undefined>,
 *   argv: string[],
 *   execPath: string,
 * }} deps
 */
export function createShellLaunch(deps) {
  // Wayland does not let a window stay on top or cut its own shape; XWayland does.
  // The platform is chosen before the rest of the shell runs, so a Wayland start relaunches once under X11.
  const X11_FLAG = '--ozone-platform=x11'

  /**
   * Start again with `args`. Inside an AppImage the running copy is a temporary
   * mount that vanishes with this process, so the AppImage file itself is relaunched.
   */
  function relaunch(args = deps.argv.slice(1)) {
    deps.app.relaunch(deps.env.APPIMAGE ? { execPath: deps.env.APPIMAGE, args } : { args })
  }

  /** @returns {boolean} 当前进程是否需要在 X11 下重启（调用时可能已经退出）。 */
  function ensureX11() {
    const needsX11 = deps.platform === 'linux' && Boolean(deps.env.WAYLAND_DISPLAY)
      && deps.env.PIGGY_WAYLAND !== '1' && !deps.argv.includes(X11_FLAG)
    if (needsX11) {
      // app.relaunch only fires on a normal quit, which never comes this early; start the copy by hand.
      deps.spawnProcess(deps.env.APPIMAGE ?? deps.execPath, [...deps.argv.slice(1), X11_FLAG], { detached: true, stdio: 'ignore' }).unref()
      deps.app.exit(0)
    }
    return needsX11
  }

  return { relaunch, ensureX11, X11_FLAG }
}
