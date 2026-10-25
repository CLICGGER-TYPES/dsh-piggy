// @ts-check
/**
 * 全屏时小猪怎么办（外壳 0.6.5 起，用户 2026-10-12 要求）：
 * 有人反馈开视频时猪「沉到最底层」——别的程序全屏时把自己设成置顶，退出后系统有时连猪的置顶一起清掉，
 * 而外壳只在启动时设过一次置顶。现在：
 *
 * - 偏好 `hide`（默认）/ `show` 存在 userData/fullscreen.json，只管这台设备，不进存档；
 * - 探测：Windows 专用 Worker 管理一个 PowerShell 小进程，每秒报一次前台窗口是不是盖满了猪所在的那块屏
 *   （或系统报告 D3D 全屏 / 演示模式）；Linux X11 用 xprop 读 `_NET_WM_STATE_FULLSCREEN`；
 *   macOS 全屏程序在单独的桌面空间里，用 visibleOnFullScreen 决定猪跟不跟进去，不用探测；
 *   探测不了时（PowerShell 被禁、没装 xprop）当作「照常显示」，设置里说明原因；
 * - 置顶守护：两档都有。置顶被清掉（always-on-top-changed / 定时核对）就抢回来；
 *   全屏刚结束时再强制重设一次，这正是「看完视频猪沉底」的那一刻。
 * @module dsh-piggy/desktop/fullscreen
 */
import { spawn as nodeSpawn, execFile as nodeExecFile } from 'node:child_process'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Worker } from 'node:worker_threads'
import { samePhysicalMonitor, isPhysicalRect } from './physical-monitor.js'

export const MODES = /** @type {const} */ (['hide', 'show'])
export const DEFAULT_MODE = 'hide'

/** @param {unknown} value @returns {'hide'|'show'} */
export function fullscreenMode(value) {
  return value === 'show' ? 'show' : 'hide'
}

/** 要不要藏猪：只在「隐藏」档、而且全屏的正是猪所在的那块屏时。 */
export function shouldHide(mode, probe) {
  return mode === 'hide' && probe !== null && probe.fullscreen === true && probe.samePigScreen === true
}

/**
 * Windows 探测脚本。用前台窗口和猪窗口各自所在的显示器句柄比较是不是同一块屏，
 * 不用把物理像素换算成 Electron 的 DIP；另报前台显示器的 rcMonitor 物理矩形，
 * 让舞台可以按猪的真实屏幕比较（窗口跨屏时 HWND 不够）。父进程（外壳）没了就自己退出。
 * @param {number} parentPid @param {string} pigHwnd 十进制窗口句柄
 */
export function windowsProbeScript(parentPid, pigHwnd) {
  return String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using System.Text;
public static class PiggyFullscreen {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public int dwFlags; }
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO i);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int state);
  public static void Init() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch {} }
  public static string Probe(uint self, IntPtr pig) {
    int q = 0; try { SHQueryUserNotificationState(out q); } catch {}
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero || h == GetShellWindow() || !IsWindowVisible(h)) return Line(false, false, q, "none");
    uint pid; GetWindowThreadProcessId(h, out pid);
    if (pid == self) return Line(false, false, q, "self");
    StringBuilder cls = new StringBuilder(64); GetClassName(h, cls, 64);
    string c = cls.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Shell_SecondaryTrayWnd") return Line(false, false, q, "desktop");
    RECT r; GetWindowRect(h, out r);
    IntPtr mon = MonitorFromWindow(h, 2);
    MONITORINFO mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    bool gotMonitor = GetMonitorInfo(mon, ref mi);
    RECT m = mi.rcMonitor;
    bool covers = r.L <= m.L && r.T <= m.T && r.R >= m.R && r.B >= m.B;
    bool fs = covers || q == 3 || q == 4;
    bool same = pig == IntPtr.Zero || MonitorFromWindow(pig, 2) == mon;
    return gotMonitor ? LineWithMonitor(fs, same, q, c, m) : Line(fs, same, q, c);
  }
  static string Line(bool fs, bool same, int q, string c) {
    return "{\"fullscreen\":" + (fs ? "true" : "false") + ",\"samePigScreen\":" + (same ? "true" : "false") + ",\"state\":" + q + ",\"cls\":\"" + c.Replace("\\", "").Replace("\"", "") + "\"}";
  }
  static string LineWithMonitor(bool fs, bool same, int q, string c, RECT m) {
    return "{\"fullscreen\":" + (fs ? "true" : "false") + ",\"samePigScreen\":" + (same ? "true" : "false") + ",\"state\":" + q + ",\"cls\":\"" + c.Replace("\\", "").Replace("\"", "") + "\",\"monitor\":{\"x\":" + m.L + ",\"y\":" + m.T + ",\"width\":" + (m.R - m.L) + ",\"height\":" + (m.B - m.T) + "}}";
  }
}
'@
[PiggyFullscreen]::Init()
$parent = ${Number(parentPid) | 0}
$pig = [IntPtr][Int64]${/^\d+$/.test(pigHwnd) ? pigHwnd : '0'}
while ($true) {
  if (-not (Get-Process -Id $parent -ErrorAction SilentlyContinue)) { exit 0 }
  [Console]::Out.WriteLine([PiggyFullscreen]::Probe([uint32]$parent, $pig))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1000
}
`
}

/** PowerShell -EncodedCommand 要 UTF-16LE 的 base64。 */
export function encodePowerShell(script) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/** @param {unknown} value @returns {{x:number,y:number,width:number,height:number}|null} */
function sanitizeMonitorRect(value) {
  if (value === null || typeof value !== 'object') return null
  const { x, y, width, height } = /** @type {any} */ (value)
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return { x, y, width, height }
}

/** 解析探测进程的一行输出；不是合法 JSON 就当没收到。 */
export function parseProbeLine(line) {
  try {
    const value = JSON.parse(String(line).trim())
    if (typeof value?.fullscreen !== 'boolean') return null
    const probe = { fullscreen: value.fullscreen, samePigScreen: value.samePigScreen !== false, state: Number(value.state) || 0, cls: String(value.cls ?? '') }
    const monitor = sanitizeMonitorRect(value.monitor)
    // 旧版 PowerShell 不报 monitor：对象保持原来的四个字段。
    return monitor === null ? probe : { ...probe, monitor }
  } catch { return null }
}

/** `xprop -root _NET_ACTIVE_WINDOW` → 窗口 id（0x… 字符串），没有就 null。 */
export function parseActiveWindow(text) {
  const match = /window id # (0x[0-9a-f]+)/i.exec(String(text))
  return match === null || /^0x0+$/i.test(match[1]) ? null : match[1]
}

/** `xprop -id W _NET_WM_STATE _NET_WM_PID` → { fullscreen, pid }。 */
export function parseWindowState(text) {
  const value = String(text)
  const pid = /_NET_WM_PID\(CARDINAL\) = (\d+)/.exec(value)
  return { fullscreen: /_NET_WM_STATE_FULLSCREEN/.test(value), pid: pid === null ? 0 : Number(pid[1]) }
}

/** `xwininfo -id W` → 窗口在屏幕上的矩形（X 的物理像素）。 */
export function parseWindowRect(text) {
  const value = String(text)
  const pick = name => { const m = new RegExp(name + ':\\s*(-?\\d+)').exec(value); return m === null ? NaN : Number(m[1]) }
  const rect = { x: pick('Absolute upper-left X'), y: pick('Absolute upper-left Y'), width: pick('Width'), height: pick('Height') }
  return Object.values(rect).every(Number.isFinite) ? rect : null
}

/** Windows 探测器本体；生产环境由专用 Worker 调用，也接受调用方提供的进程创建器。
 * @param {{selfPid:number,pigHwnd:string,onProbe:(probe:any)=>void,
 *   onStatus:(status:{supported:boolean,reason:string})=>void,
 *   log?:(...parts:any[])=>void,spawn?:typeof nodeSpawn}} options
 */
export function createWindowsProbe(options) {
  const spawn = options.spawn ?? nodeSpawn
  const log = options.log ?? (() => {})
  let supported = null
  let child = null
  let childClosed = Promise.resolve()
  let timer = null
  let stopped = false

  function unsupported(reason) {
    if (supported === false) return
    supported = false
    options.onStatus({ supported, reason })
    log('fullscreen probe unavailable', reason)
    options.onProbe(null)
  }

  function start() {
    if (stopped) return
    const script = windowsProbeScript(options.selfPid, options.pigHwnd)
    try {
      child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShell(script)],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) { unsupported('启动 PowerShell 失败：' + (error instanceof Error ? error.message : String(error))); return }
    const running = child
    childClosed = new Promise(resolve => running.once('close', () => {
      if (child === running) child = null
      resolve(undefined)
    }))
    let buffer = ''
    let errText = ''
    running.stdout.setEncoding('utf8')
    running.stdout.on('data', chunk => {
      if (stopped) return
      buffer += chunk
      let at
      while ((at = buffer.indexOf('\n')) >= 0) {
        const probe = parseProbeLine(buffer.slice(0, at))
        buffer = buffer.slice(at + 1)
        if (probe === null) continue
        if (supported !== true) {
          supported = true
          options.onStatus({ supported, reason: '' })
          log('fullscreen probe ready')
        }
        options.onProbe(probe)
      }
    })
    running.stderr.setEncoding('utf8')
    running.stderr.on('data', chunk => { errText = (errText + chunk).slice(-600) })
    running.on('error', error => unsupported('PowerShell 不可用：' + error.message))
    running.on('exit', code => {
      if (stopped) return
      log('fullscreen probe exited', code, errText.trim())
      if (supported === true) {
        options.onProbe(null)
        timer = setTimeout(start, 5000)
        timer.unref?.()
      } else unsupported(errText.trim() ? 'PowerShell 报错：' + errText.trim().split('\n')[0] : 'PowerShell 被禁用或无法运行')
    })
  }

  return {
    start,
    stop() {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      // close 晚于进程退出和 stdout/stderr 关闭，不能只发 kill 就让 Worker 消失。
      if (child !== null) child.kill()
      return childClosed
    },
  }
}

/** 主进程只转发状态，PowerShell 的创建、流处理和重启全部留在 Worker。 */
function createWindowsProbeWorker(options) {
  let worker = null
  let running = false
  let exited = Promise.resolve()
  let stopping = null
  let rejectStop = null
  return {
    start() {
      try {
        worker = new Worker(new URL('./fullscreen-worker.js', import.meta.url), {
          workerData: { selfPid: options.selfPid, pigHwnd: options.pigHwnd },
        })
      } catch (error) { options.onError('全屏探测 Worker 无法启动：' + String(error)); return }
      running = true
      exited = new Promise(resolve => worker.once('exit', code => {
        running = false
        if (stopping === null) options.onError('全屏探测 Worker 已退出：' + code)
        resolve(undefined)
      }))
      worker.on('message', message => {
        if (message.kind === 'stop-error') {
          rejectStop?.(new Error(message.error))
          stopping = null
        } else if (stopping === null) {
          if (message.kind === 'probe') options.onProbe(message.value)
          else if (message.kind === 'status') options.onStatus(message.value)
          else if (message.kind === 'log') options.log(...message.parts)
        }
      })
      worker.on('error', error => options.onError('全屏探测 Worker 不可用：' + error.message))
    },
    stop() {
      if (stopping !== null) return stopping
      if (!running) return Promise.resolve()
      stopping = new Promise((resolve, reject) => {
        rejectStop = reject
        exited.then(() => resolve(undefined))
        try { worker.postMessage({ kind: 'stop' }) } catch (error) { reject(error) }
      })
      return stopping
    },
  }
}

/**
 * @param {{
 *   path: string, platform: string, selfPid: number,
 *   pigHwnd: () => string, pigDisplayBounds: () => ({x:number,y:number,width:number,height:number}|null),
 *   windowsPigDisplayBounds?: () => ({x:number,y:number,width:number,height:number}|null),
 *   onProbe: (probe: {fullscreen:boolean,samePigScreen:boolean,monitor?:{x:number,y:number,width:number,height:number}}|null) => void,
 *   log?: (...parts: any[]) => void,
 *   spawn?: typeof nodeSpawn, execFile?: typeof nodeExecFile,
 * }} options
 */
export function createFullscreenWatch(options) {
  const { path, platform, selfPid, onProbe } = options
  const log = options.log ?? (() => {})
  const execFile = options.execFile ?? nodeExecFile
  let mode = DEFAULT_MODE
  let initialization = null
  /** @type {Promise<any>} */
  let writing = Promise.resolve()
  /** null = 还在探测；true / false = 能不能探测 */
  let supported = platform === 'darwin' ? true : null
  let reason = ''
  let windows = null
  let timer = null
  let stopped = false

  function init() {
    if (initialization === null) initialization = (async () => {
      try { mode = fullscreenMode(JSON.parse(await readFile(path, 'utf8')).mode) } catch { /* 没设过：默认隐藏 */ }
    })()
    return initialization
  }

  const get = () => ({ mode, supported: supported !== false, checking: supported === null, reason, platform })

  function unsupported(why) {
    if (supported === false) return
    supported = false
    reason = why
    log('fullscreen probe unavailable', why)
    onProbe(null)
  }

  /** 只有舞台注入 getter 时才用 PS 报来的前台显示器物理矩形替代 HWND 比较。 */
  function overrideWindowsPigScreen(probe) {
    const getBounds = options.windowsPigDisplayBounds
    if (probe === null || typeof getBounds !== 'function' || probe.monitor === undefined) return probe
    let pig = null
    try { pig = getBounds() } catch { return probe }
    if (!isPhysicalRect(pig)) return probe
    return { ...probe, samePigScreen: samePhysicalMonitor(probe.monitor, pig) }
  }

  function startWindows() {
    const settings = { selfPid, pigHwnd: options.pigHwnd(), onProbe: probe => onProbe(overrideWindowsPigScreen(probe)), log,
      onStatus: status => { supported = status.supported; reason = status.reason } }
    // 提供自定义 spawn 的调用方继续直接使用同一探测器，不把函数序列化进 Worker。
    windows = options.spawn ? createWindowsProbe({ ...settings, spawn: options.spawn })
      : createWindowsProbeWorker({ ...settings, onError: unsupported })
    windows.start()
  }

  const run = (file, args) => new Promise(resolve => {
    try { execFile(file, args, { timeout: 2000 }, (error, stdout) => resolve(error ? null : String(stdout))) }
    catch { resolve(null) }
  })

  async function pollLinux() {
    if (stopped) return
    const active = await run('xprop', ['-root', '_NET_ACTIVE_WINDOW'])
    if (stopped) return
    if (active === null) { unsupported('没找到 xprop，检测不了全屏'); return }
    if (supported !== true) { supported = true; reason = '' }
    const id = parseActiveWindow(active)
    let probe = { fullscreen: false, samePigScreen: false }
    if (id !== null) {
      const state = parseWindowState(await run('xprop', ['-id', id, '_NET_WM_STATE', '_NET_WM_PID']) ?? '')
      if (stopped) return
      if (state.fullscreen && state.pid !== selfPid) {
        const rect = parseWindowRect(await run('xwininfo', ['-id', id]) ?? '')
        const pig = options.pigDisplayBounds()
        // 拿不到矩形就当作同一块屏：宁可藏错，也别挡着看片。
        const same = rect === null || pig === null || (rect.x + rect.width / 2 >= pig.x && rect.x + rect.width / 2 < pig.x + pig.width &&
          rect.y + rect.height / 2 >= pig.y && rect.y + rect.height / 2 < pig.y + pig.height)
        probe = { fullscreen: true, samePigScreen: same }
      }
    }
    if (stopped) return
    onProbe(probe)
    timer = setTimeout(pollLinux, 1500)
    timer.unref?.()
  }

  return {
    init,
    start() {
      if (stopped) return
      if (platform === 'win32') startWindows()
      else if (platform === 'linux') pollLinux()
    },
    stop() {
      stopped = true
      if (timer !== null) clearTimeout(timer)
      return windows?.stop() ?? Promise.resolve()
    },
    get,
    /** @param {unknown} next */
    set(next) {
      if (!MODES.includes(/** @type {any} */ (next))) return Promise.resolve({ ok: false, reason: '无效的选项' })
      writing = writing.then(async () => {
        await init()
        mode = fullscreenMode(next)
        try {
          await mkdir(dirname(path), { recursive: true })
          await writeFile(path + '.tmp', JSON.stringify({ mode }) + '\n')
          await rename(path + '.tmp', path)
        } catch (error) { log('fullscreen save failed', String(error)) }
        return { ok: true, ...get() }
      })
      return writing
    },
    flush: () => writing,
    mode: () => mode,
  }
}
