// @ts-check
/** 外壳重启：AppImage 与 Windows portable 都不能用进程内的临时 execPath。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createShellLaunch } from '../lib/shell-launch.js'

/** @param {Record<string, string | undefined>} env */
function fixture(env = {}, platform = 'win32') {
  const calls = []
  const spawns = []
  const launch = createShellLaunch({
    app: { relaunch: options => calls.push(options), exit: code => calls.push({ exit: code }) },
    spawnProcess: (...args) => { spawns.push(args); return { unref() {} } },
    platform,
    env,
    argv: ['C:\\app\\dsh-piggy.exe', '--flag'],
    execPath: 'C:\\Temp\\extracted\\dsh-piggy.exe',
  })
  return { launch, calls, spawns }
}

test('普通安装用 app.relaunch 默认路径', () => {
  const { launch, calls } = fixture()
  launch.relaunch(['--next'])
  assert.deepEqual(calls, [{ args: ['--next'] }])
})

test('AppImage 用镜像文件本身', () => {
  const { launch, calls } = fixture({ APPIMAGE: '/opt/dsh-piggy.AppImage' })
  launch.relaunch()
  assert.deepEqual(calls, [{ execPath: '/opt/dsh-piggy.AppImage', args: ['--flag'] }])
})

test('Windows portable 用原始 portable.exe，而不是 %TEMP% 解包副本', () => {
  const { launch, calls } = fixture({ PORTABLE_EXECUTABLE_FILE: 'C:\\Users\\pig\\dsh-piggy-portable.exe' })
  launch.relaunch(['--next'])
  assert.deepEqual(calls, [{ execPath: 'C:\\Users\\pig\\dsh-piggy-portable.exe', args: ['--next'] }])
})

test('Wayland 启动仍手动拉起 X11 副本', () => {
  const { launch, spawns, calls } = fixture({ WAYLAND_DISPLAY: 'wayland-0' }, 'linux')
  assert.equal(launch.ensureX11(), true)
  assert.equal(spawns.length, 1)
  assert.equal(spawns[0][0], 'C:\\Temp\\extracted\\dsh-piggy.exe')
  assert.deepEqual(spawns[0][1], ['--flag', '--ozone-platform=x11'])
  assert.deepEqual(calls, [{ exit: 0 }])
})
