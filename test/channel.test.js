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

test('Gitee 在线扩展目录：地址用 Gitee，官方哈希与同版本 GitHub 条目一致', () => {
  const github = JSON.parse(readFileSync(new URL('../extensions/registry.json', import.meta.url), 'utf8'))
  const gitee = JSON.parse(readFileSync(new URL('../extensions/registry-gitee.json', import.meta.url), 'utf8'))
  const official = JSON.parse(readFileSync(new URL('../store/official-extensions.json', import.meta.url), 'utf8'))
  assert.doesNotMatch(JSON.stringify(gitee), /github/i)
  assert.deepEqual(gitee.extensions.map(e => e.key).sort(), github.extensions.map(e => e.key).sort())
  for (const entry of gitee.extensions) {
    if (entry.builtin === true) continue
    const known = official[entry.key]?.[entry.version]
    assert.ok(known, `${entry.key}@${entry.version} lacks official file hashes`)
    assert.deepEqual(Object.keys(entry.files ?? {}).sort(), Object.keys(known).sort(), `${entry.key}@${entry.version} file set`)
    const twin = github.extensions.find(e => e.key === entry.key && e.version === entry.version)
    const base = `${GITEE.downloadBase}/ext-${entry.key}-${entry.version}`
    assert.equal(entry.bundle?.url, `${base}/ext-${entry.key}-${entry.version}.piggyext`)
    for (const [name, spec] of Object.entries(entry.files)) {
      // 图片在发行版里平铺：目录里叫 assets/x.webp，附件名是 x.webp
      assert.equal(spec.url, `${base}/${name.replace(/^assets\//, '')}`)
      assert.equal(spec.sha256, known[name], `${entry.key}@${entry.version} official hash: ${name}`)
      if (twin) assert.equal(spec.sha256, twin.files[name].sha256, `${entry.key}@${entry.version} cross-channel hash: ${name}`)
    }
  }
  const githubFarm = github.extensions.find(e => e.key === 'farm')
  const giteeFarm = gitee.extensions.find(e => e.key === 'farm')
  assert.equal(githubFarm?.version, '4.2.1')
  assert.equal(githubFarm?.bundle?.sha256, 'bde53852c08f3cb28d5a7155a6efa30988336df2f80be6f96c41fecea86d7fa0')
  assert.equal(giteeFarm?.version, '4.2.0')
  assert.equal(giteeFarm?.bundle?.sha256, '51c4f1ca631b18366db64fa254c63885bff3c07e19347651e4fd5096db2aad0d')
})

test('候选渠道目录互相匹配，Gitee候选不包含GitHub链接', async () => {
  const { existsSync } = await import('node:fs')
  const path = new URL('../release-candidates/extensions/registry.json', import.meta.url)
  if (!existsSync(path)) return
  const github = JSON.parse(readFileSync(path, 'utf8'))
  const gitee = JSON.parse(readFileSync(new URL('../release-candidates/extensions/registry-gitee.json', import.meta.url), 'utf8'))
  assert.doesNotMatch(JSON.stringify(gitee), /github/i)
  assert.deepEqual(gitee.extensions.map(item => item.key + '@' + item.version), github.extensions.map(item => item.key + '@' + item.version))
  const withoutUrls = value => {
    if (Array.isArray(value)) return value.map(withoutUrls)
    if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'url').map(([key, nested]) => [key, withoutUrls(nested)]))
    return value
  }
  for (const item of github.extensions.filter(item => !item.builtin)) {
    const twin = gitee.extensions.find(other => other.key === item.key)
    assert.deepEqual(withoutUrls(twin), withoutUrls(item), `${item.key}@${item.version} candidate metadata`)
    assert.equal(twin.bundle.sha256, item.bundle.sha256)
    for (const [name, file] of Object.entries(item.files)) assert.equal(twin.files[name].sha256, file.sha256)
  }
})
