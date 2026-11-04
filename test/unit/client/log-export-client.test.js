// 设置 → 日志 → 导出的界面一侧：桌面版走外壳的系统「另存为」，
// 网页版走浏览器的另存为，都不支持时至少下载得下来。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, mount, openPanel, settle } from '../../helpers/bundle.js'

const EXPORT = 'dsh-piggy 日志\n导出时间： 2026-10-06 13:20:11.000\n游戏版本： 0.31.0\n'

/** 打开设置页。 */
async function openSettings(options) {
  const mounted = await mount(options)
  openPanel(mounted.dom)
  await settle()
  findByAttr(contentOf(mounted.dom), 'data-app', 'settings').fire('click')
  return mounted
}

test('设置里有「导出日志」，点一下就把这一份交给外壳保存', async () => {
  const saved = []
  const { dom, calls } = await openSettings({
    status: SNAPSHOT,
    exportText: EXPORT,
    windowExtra: {
      piggyShell: {
        logs: {
          save: async (name, text) => { saved.push({ name, text }); return { ok: true, path: '/home/me/' + name } },
        },
      },
    },
  })
  const button = findByAttr(contentOf(dom), 'data-export-logs', 'true')
  assert.ok(button, 'the log entry must be in settings')
  // 设置行里的按钮统一是 dp-mini（和「更新」「扩展」同一套尺寸和样式），
  // 这是用户 2026-10-06 明确要求的：新功能不许自己造一个按钮样子。
  assert.match(button.className, /(^|\s)dp-mini(\s|$)/, 'the entry must use the shared dp-mini button')
  for (const other of ['[data-open-update]', '[data-open-extensions]']) {
    const peer = findByAttr(contentOf(dom), other.slice(1, -1).split('=')[0], 'true')
    assert.match(peer.className, /(^|\s)dp-mini(\s|$)/, 'its peers use dp-mini too')
  }
  button.fire('click')
  await settle()
  await settle()
  assert.equal(saved.length, 1, 'the desktop shell must get the save call')
  assert.match(saved[0].name, /^dsh-piggy-log-\d{8}-\d{4}\.txt$/)
  assert.equal(saved[0].text, EXPORT)
  assert.ok(calls.some(call => String(call.url).includes('/dsh-piggy/logs/export')), 'export must come from the host')
})

test('网页版用浏览器的另存为对话框', async () => {
  const written = []
  const { dom } = await openSettings({
    status: SNAPSHOT,
    exportText: EXPORT,
    windowExtra: {
      showSaveFilePicker: async options => ({
        suggestedName: options.suggestedName,
        async createWritable() {
          return { write: async text => { written.push(text) }, close: async () => {} }
        },
      }),
    },
  })
  findByAttr(contentOf(dom), 'data-export-logs', 'true').fire('click')
  await settle()
  await settle()
  assert.deepEqual(written, [EXPORT])
})

test('用户取消另存为时不报错，界面当没事发生', async () => {
  const { dom } = await openSettings({
    status: SNAPSHOT,
    exportText: EXPORT,
    windowExtra: {
      showSaveFilePicker: async () => { const error = new Error('cancelled'); error.name = 'AbortError'; throw error },
    },
  })
  findByAttr(contentOf(dom), 'data-export-logs', 'true').fire('click')
  await settle()
  await settle()
  // 面板重画过，要重新找那个按钮。
  const after = findByAttr(contentOf(dom), 'data-export-logs', 'true')
  assert.equal(after.disabled, false, 'the button comes back after a cancel')
  assert.equal(after.textContent, '📄 导出')
})

test('没有另存为可用时退回下载，不让用户什么都拿不到', async () => {
  const urls = []
  const original = URL.createObjectURL
  URL.createObjectURL = () => { urls.push('blob'); return 'blob:fake' }
  try {
    const { dom } = await openSettings({ status: SNAPSHOT, exportText: EXPORT })
    findByAttr(contentOf(dom), 'data-export-logs', 'true').fire('click')
    await settle()
    await settle()
    assert.equal(urls.length, 1, 'the fallback must hand the file to the browser')
  } finally {
    URL.createObjectURL = original
  }
})
