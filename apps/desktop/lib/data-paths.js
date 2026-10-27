// @ts-check
/** Desktop data lives in one piggy directory, independently of the executable. */
import { homedir } from 'node:os'
import { posix, win32, join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

/** Resolve platform paths without loading Electron (also used by migration tests).
 * @param {{platform?:string,home?:string,appData?:string,legacyUserData?:string,env?:NodeJS.ProcessEnv,argv?:string[]}} [options]
 */
export function desktopDataPaths({ platform = process.platform, home = homedir(), appData,
  legacyUserData, env = process.env, argv = process.argv } = {}) {
  const path = platform === 'win32' ? win32 : posix
  let explicit = env.PIGGY_USERDATA || ''
  if (!explicit) {
    for (let index = 0; index < argv.length; index++) {
      if (argv[index].startsWith('--user-data-dir=')) explicit = argv[index].slice(16)
      else if (argv[index] === '--user-data-dir' && argv[index + 1]) explicit = argv[++index]
    }
  }
  const linuxRoot = env.XDG_DATA_HOME && path.isAbsolute(env.XDG_DATA_HOME)
    ? env.XDG_DATA_HOME : path.join(home, '.local', 'share')
  const userData = explicit ? path.resolve(explicit) : path.join(platform === 'linux' ? linuxRoot : appData, 'piggy')
  return { userData, statePath: path.join(userData, 'state.json'),
    legacyUserData: explicit ? userData : legacyUserData }
}

export function configureDesktopData(app) {
  const argv = app.commandLine?.hasSwitch?.('user-data-dir')
    ? [...process.argv, '--user-data-dir=' + app.commandLine.getSwitchValue('user-data-dir')] : process.argv
  const paths = desktopDataPaths({ appData: app.getPath('appData'), legacyUserData: app.getPath('userData'), argv })
  mkdirSync(paths.userData, { recursive: true, mode: 0o700 })
  app.setPath('userData', paths.userData)
  return paths
}

/** The same bundled-game lookup for split and transparent-stage entry points. */
export function bundledDesktopGame(app, appRoot, env = process.env) {
  if (env.PIGGY_BUNDLED_GAME) return resolve(env.PIGGY_BUNDLED_GAME)
  return app.isPackaged ? join((/** @type {NodeJS.Process & {resourcesPath:string}} */ (process)).resourcesPath, 'game') : join(appRoot, 'game')
}
