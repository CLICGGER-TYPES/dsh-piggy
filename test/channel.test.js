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
