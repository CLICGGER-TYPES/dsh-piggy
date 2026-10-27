// 发布渠道：GitHub 是默认，Gitee 渠道打出来的东西只许指向 gitee.com。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { CHANNEL as ACTIVE } from '../channel.js'
import { CHANNEL as GITHUB } from '../channels/github.js'
import { CHANNEL as GITEE } from '../channels/gitee.js'

test('仓库里提交的渠道是 github（GitHub 现有行为不变）', () => {
  assert.equal(ACTIVE.name, 'github')
  assert.deepEqual(ACTIVE, GITHUB)
  assert.equal(readFileSync(new URL('../apps/desktop/lib/channel.js', import.meta.url), 'utf8'), readFileSync(new URL('../channels/github.js', import.meta.url), 'utf8'))
})

test('两个渠道字段一致；Gitee 渠道的地址全是 gitee.com，不含 github', () => {
  assert.deepEqual(Object.keys(GITEE).sort(), Object.keys(GITHUB).sort())
  for (const [key, value] of Object.entries(GITEE)) {
    if (key === 'name') continue
    assert.ok(String(value).startsWith('https://gitee.com/'), key + ' 不是 gitee.com：' + value)
  }
  assert.doesNotMatch(readFileSync(new URL('../channels/gitee.js', import.meta.url), 'utf8'), /github/i)
})

test('Gitee 在线扩展目录：下载地址都在 Gitee 发行版，校验值和 GitHub 那份一样', () => {
  const github = JSON.parse(readFileSync(new URL('../extensions/registry.json', import.meta.url), 'utf8'))
  const gitee = JSON.parse(readFileSync(new URL('../extensions/registry-gitee.json', import.meta.url), 'utf8'))
  assert.doesNotMatch(JSON.stringify(gitee), /github/i)
  assert.deepEqual(gitee.extensions.map(e => e.key + '@' + e.version), github.extensions.map(e => e.key + '@' + e.version))
  for (const entry of gitee.extensions) {
    if (!entry.files) continue
    const twin = github.extensions.find(e => e.key === entry.key)
    for (const [name, spec] of Object.entries(entry.files)) {
      // 图片在发行版里平铺：目录里叫 assets/x.webp，附件名是 x.webp
      assert.equal(spec.url, `${GITEE.downloadBase}/ext-${entry.key}-${entry.version}/${name.replace(/^assets\//, '')}`)
      assert.equal(spec.sha256, twin.files[name].sha256)
    }
  }
})

test('候选渠道目录互相匹配，Gitee候选不包含GitHub链接', async () => {
  const { existsSync } = await import('node:fs')
  const path = new URL('../release-candidates/extensions/registry.json', import.meta.url)
  if (!existsSync(path)) return
  const github = JSON.parse(readFileSync(path, 'utf8'))
  const gitee = JSON.parse(readFileSync(new URL('../release-candidates/extensions/registry-gitee.json', import.meta.url), 'utf8'))
  assert.doesNotMatch(JSON.stringify(gitee), /github/i)
  assert.deepEqual(gitee.extensions.map(item => item.key + '@' + item.version), github.extensions.map(item => item.key + '@' + item.version))
  for (const item of github.extensions.filter(item => !item.builtin)) {
    const twin = gitee.extensions.find(other => other.key === item.key)
    assert.equal(twin.bundle.sha256, item.bundle.sha256)
    for (const [name, file] of Object.entries(item.files)) assert.equal(twin.files[name].sha256, file.sha256)
  }
})
