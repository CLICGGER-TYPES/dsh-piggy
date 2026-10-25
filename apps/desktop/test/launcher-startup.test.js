// @ts-check
/**
 * 启动诊断：入口 import 失败、第二个进程拿不到单实例锁、显示门一直不开。
 * 只跑纯逻辑和源码接线检查；不启动 Electron、不开窗口（GUI 由 root 在虚拟机验收）。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { reportLauncherFailure } from '../lib/launcher-startup.js'
import { appendJournal, appendJournalSync, journalLine } from '../lib/startup-journal.js'
import { pageCrashReason } from '../lib/startup-failure.js'

const LAUNCHER = readFileSync(new URL('../launcher.js', import.meta.url), 'utf8')
const MAIN = readFileSync(new URL('../main.js', import.meta.url), 'utf8')

/** @param {(dir: string) => void | Promise<void>} run */
async function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-startup-'))
  try {
    await run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** 一次启动失败报告用的假 electron。 */
function fakeElectron({ userData, version = '0.6.7', dialog, exit = () => {} }) {
  return {
    app: {
      getPath: name => {
        assert.equal(name, 'userData')
        return userData
      },
      getVersion: () => version,
      exit,
    },
    dialog,
  }
}

test('launcher 的入口 import 失败也会写日志并弹一次', () => {
  assert.match(LAUNCHER, /try \{[\s\S]*import\('\.\/stage\/main\.js'\)[\s\S]*import\('\.\/main\.js'\)[\s\S]*catch \(error\)[\s\S]*reportLauncherFailure/,
    '缺模块/语法错误时 launcher 必须自己报告，不能只靠 main.js 的 whenReady().catch')
  assert.ok(!/from ['"]electron['"]/.test(LAUNCHER), '正常启动时 launcher 不加载 electron')
})

test('import 失败的原始堆栈先落进 piggy.log，再弹一次对话框', async () => {
  await withTempDir(async dir => {
    const order = []
    let atDialog = null
    let opened = null
    const error = new Error('Cannot find module ./lib/missing.js')
    const result = await reportLauncherFailure({
      error,
      loadElectron: async () => fakeElectron({
        userData: dir,
        dialog: {
          showMessageBoxSync: options => {
            order.push('dialog')
            atDialog = readFileSync(join(dir, 'piggy.log'), 'utf8')
            opened = options
          },
        },
      }),
    })

    assert.deepEqual(result, { dialog: true })
    assert.deepEqual(order, ['dialog'])
    assert.match(atDialog, /^\[.+\] startup failed /, '弹框前日志里已经有这一行')
    assert.match(atDialog, /startup failed \(launcher\)|startup failed/, 'error tag is stable')
    assert.match(atDialog, /Cannot find module \.\/lib\/missing\.js/)
    assert.match(atDialog, /launcher-startup|Error/, 'the journal keeps the stack, not just the message')
    assert.equal(opened.type, 'error')
    assert.match(opened.message, /猪没能出来/)
    assert.match(opened.detail, /Cannot find module/)
    assert.match(opened.detail, /piggy\.log/)
    assert.match(opened.detail, /0\.6\.7/)

    const journal = readFileSync(join(dir, 'piggy.log'), 'utf8')
    assert.match(journal, /Cannot find module \.\/lib\/missing\.js/)
  })
})

test('electron 加载不了时错误进 stderr，并以 1 退出', async () => {
  const order = []
  const result = await reportLauncherFailure({
    error: new Error('first-run.js syntax error'),
    loadElectron: async () => { throw new Error('electron unavailable') },
    stderr: text => order.push(text),
    exit: code => order.push('exit:' + code),
  })
  assert.deepEqual(result, { dialog: false })
  assert.ok(order.some(line => /startup failed \(launcher\)/.test(line) && /first-run\.js syntax error/.test(line)),
    '错误不能因为拿不到 electron 就消失')
  assert.equal(order.at(-1), 'exit:1')
})

test('piggy.log 写不进去时仍然弹一次，错误同时落到 stderr', async () => {
  await withTempDir(async dir => {
    // userData 指向一个普通文件：创建目录失败，原日志写不进去。
    const notADir = join(dir, 'not-a-dir')
    writeFileSync(notADir, 'x')
    const stderr = []
    let dialogs = 0
    const result = await reportLauncherFailure({
      error: new Error('journal blocked'),
      loadElectron: async () => fakeElectron({
        userData: notADir,
        dialog: { showMessageBoxSync: () => { dialogs += 1 } },
      }),
      stderr: text => stderr.push(text),
      exit: () => {},
    })
    assert.deepEqual(result, { dialog: true })
    assert.equal(dialogs, 1)
    assert.ok(stderr.some(line => /startup failed/.test(line) && /journal blocked/.test(line)))
  })
})

test('pageCrashReason 把 Electron 的原文原因和退出码带进对话框', () => {
  assert.equal(pageCrashReason({ reason: 'crashed', exitCode: 5 }), '游戏页面进程在窗口显示前退出了（crashed，退出码 5）')
  assert.equal(pageCrashReason({ reason: 'oom' }), '游戏页面进程在窗口显示前退出了（oom）')
  assert.equal(pageCrashReason({}), '游戏页面进程在窗口显示前退出了（unknown）')
  assert.equal(pageCrashReason(), '游戏页面进程在窗口显示前退出了（unknown）')
})

test('启动日志行格式和 main.js 原来的一致', () => {
  assert.equal(journalLine(['content', '{"x":1}'], new Date('2026-10-25T03:04:05.000Z')),
    '[2026-10-25T03:04:05.000Z] content {"x":1}\n')
  assert.match(MAIN, /const line = journalLine\(parts\)/, 'main.js 的 log 复用同一份行格式')
})

test('appendJournal 追加成功、写不进去只返回 false', async () => {
  await withTempDir(async dir => {
    const file = join(dir, 'logs', 'piggy.log')
    assert.equal(await appendJournal(file, journalLine(['one'], new Date('2026-10-25T00:00:00.000Z'))), true)
    assert.equal(await appendJournal(file, journalLine(['two'], new Date('2026-10-25T00:00:01.000Z'))), true)
    assert.equal(readFileSync(file, 'utf8'),
      '[2026-10-25T00:00:00.000Z] one\n[2026-10-25T00:00:01.000Z] two\n')
    const notADir = join(dir, 'file')
    writeFileSync(notADir, 'x')
    assert.equal(await appendJournal(join(notADir, 'piggy.log'), 'nope\n'), false)
  })
})

test('appendJournalSync 只在单实例退出路径写一次，写不进去只返回 false', async () => {
  await withTempDir(async dir => {
    const file = join(dir, 'logs', 'piggy.log')
    assert.equal(appendJournalSync(file, journalLine(['one'], new Date('2026-10-25T00:00:00.000Z'))), true)
    assert.equal(appendJournalSync(file, journalLine(['two'], new Date('2026-10-25T00:00:01.000Z'))), true)
    assert.equal(readFileSync(file, 'utf8'),
      '[2026-10-25T00:00:00.000Z] one\n[2026-10-25T00:00:01.000Z] two\n')
    const notADir = join(dir, 'file')
    writeFileSync(notADir, 'x')
    assert.equal(appendJournalSync(join(notADir, 'piggy.log'), 'nope\n'), false)
  })
})

test('第二个进程拿不到单实例锁时先同步写日志再退出', () => {
  assert.match(MAIN, /requestSingleInstanceLock\(\)[\s\S]{0,700}second launch rejected[\s\S]{0,400}app\.quit\(\)/,
    '没有这一行，日志里看不出「又双击了一次」')
  const lock = MAIN.indexOf('if (!needsX11 && !app.requestSingleInstanceLock())')
  const journal = MAIN.indexOf('appendJournalSync(', lock)
  const quit = MAIN.indexOf('app.quit()', journal)
  assert.ok(lock !== -1 && journal > lock && quit > journal, '退出路径不能等异步回调，必须先同步落盘再 quit')
  assert.doesNotMatch(MAIN, /appendFileSync/, '同步日志写在 lib/startup-journal.js 里，不在 main.js 展开')
})

test('第二次启动时第一个进程的日志能对上前一个进程的 pid 和 host 状态', () => {
  assert.match(MAIN, /'second instance'[\s\S]{0,300}pid: process\.pid[\s\S]{0,200}host: host !== null/)
})

test('显示门一直不开时日志能区分卡在哪一步', () => {
  assert.match(MAIN, /did-finish-load[\s\S]{0,500}showGate\.status\(\)/, 'page loaded 要带上显示门状态')
  assert.match(MAIN, /page loaded before show gate opened/, '加载完但没显示要单独一行')
  assert.match(MAIN, /log\('show fallback'/, 'Linux 超时兜底显示也要留下证据')
  assert.match(MAIN, /'unresponsive'[\s\S]{0,200}showGate\.status\(\)/, '窗口卡住时记下显示门状态')
})

test('窗口还没显示过就崩：先写日志再弹一次，然后退出', () => {
  assert.match(MAIN, /render-process-gone[\s\S]{0,600}reportStartupCrash\(details, gate\)/,
    '启动时渲染进程退出也必须可见，不能只留一行日志')
  assert.match(MAIN, /async function reportStartupCrash[\s\S]{0,900}pageCrashReason\(details\)[\s\S]{0,300}app\.quit\(\)/)
  assert.match(MAIN, /renderer gone[\s\S]{0,300}visible: win\?\.isVisible\?\.\(\) === true[\s\S]{0,200}gate/,
    '日志要记下崩溃时窗口是否已显示、显示门状态')
})

test('asynchronous filesystem errors are reported as failed journal writes', async () => {
  await withTempDir(async dir => {
    assert.equal(await appendJournal(dir, 'cannot append to a directory\n'), false)
  })
})

test('early import failure uses the native API allowed before ready without waiting for ready', async () => {
  await withTempDir(async dir => {
    let dialogs = 0
    const electron = fakeElectron({ userData: dir, dialog: {
      showMessageBoxSync: () => { throw new Error('not ready') },
      showErrorBox: (_title, detail) => {
        assert.match(readFileSync(join(dir, 'piggy.log'), 'utf8'), /early import failure/)
        assert.match(detail, /early import failure/)
        dialogs += 1
      },
    } })
    ;/** @type {any} */ (electron.app).isReady = () => false
    ;/** @type {any} */ (electron.app).whenReady = () => { throw new Error('must not block ESM entry on ready') }
    assert.deepEqual(await reportLauncherFailure({ error: new Error('early import failure'), loadElectron: async () => electron, exit() {} }), { dialog: true })
    assert.equal(dialogs, 1)
  })
})
