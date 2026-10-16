import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeDom } from './helpers/bundle.js'
import { renderUpdateTab } from '../src/client/tabs/update.js'

const current = { version: '0.37.0', shell: '0.6.6', bundled: false }
const releases = [
  { version: '0.37.2', date: '2026-10-16', prerelease: false, blocked: null, page: '', notes: 'first release notes' },
  { version: '0.37.1', date: '2026-10-15', prerelease: false, blocked: null, page: '', notes: 'second release notes' },
]

function findByAttribute(root, attribute, value) {
  let match = null
  root.walk(node => { if (node.getAttribute(attribute) === value) match = node })
  return match
}

function findByClass(root, className) {
  let match = null
  root.walk(node => { if (node.className.split(/\s+/).includes(className)) match = node })
  return match
}

test('更新说明的内部滚动 key 按版本稳定且互相隔离', async () => {
  const dom = fakeDom()
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { piggyShell: { updates: {
      current: async () => current,
      list: async () => ({ ok: true, releases }),
      onProgress() {},
    } } },
  })
  const ui = {
    content: dom.body,
    renderContent() { dom.body.textContent = ''; renderUpdateTab(ui) },
  }

  try {
    renderUpdateTab(ui)
    await new Promise(resolve => setTimeout(resolve, 0))
    for (const release of releases) {
      const header = findByAttribute(dom.body, 'data-release', release.version)
      assert.ok(header, 'release header should render')
      header.fire('click')
      const notes = findByClass(dom.body, 'dp-update-notes')
      assert.ok(notes, 'expanded release should render its notes')
      assert.equal(notes.getAttribute('data-scroll-key'), 'update-notes:' + release.version)
    }
  } finally {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument)
    else delete globalThis.document
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
    else delete globalThis.window
  }
})
