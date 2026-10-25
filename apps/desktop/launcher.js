// @ts-check
/**
 * 桌面版的打包入口：只选入口，不初始化窗口。
 *
 * `package.json` 的 main 指向这里，所以 app.getAppPath()/版本/资源路径仍在 apps/desktop 根目录。
 * 默认动态 import 原来的 `./main.js`（双窗口）；显式 `--window-mode=stage` 或兼容的 `--stage`
 * 才进入候选的 `./stage/main.js`，`--window-mode=split` 可回退原入口。
 * 两个入口自己的 Electron 初始化和生命周期都保留，这里不 require/import electron。
 *
 * import 入口失败时（缺模块、语法错误、入口文件没打进包里），main.js 的 whenReady().catch
 * 还没挂上，打包版又没有控制台：所以这里必须自己把错误落进启动日志并弹一次，
 * 见 lib/launcher-startup.js。正常启动仍不加载 electron。
 */
import { reportLauncherFailure } from './lib/launcher-startup.js'
import { selectWindowMode } from './lib/window-mode.js'

const mode = selectWindowMode(process.argv.slice(1))

try {
  if (mode === 'stage') {
    await import('./stage/main.js')
  } else {
    await import('./main.js')
  }
} catch (error) {
  await reportLauncherFailure({ error })
}
