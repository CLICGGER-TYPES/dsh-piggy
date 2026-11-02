import test from 'node:test'
import { STATE_VERSION, hatchEgg, layEgg } from '../core.js'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createSaveArchive, parseSaveArchive } from '../runtime/save-archive.js'
import { makeZip, readZip } from '../runtime/save-zip.js'
import { officialList } from '../store/ext-import.js'
import { assetNames, fileList } from '../store/ext-files.js'
import { REQUIRED_SKIN_SCENES, SKIN_SCENES } from '../packages/pet-core/src/data/skins.js'

const NOW = 1_797_000_000_000
const skinSvg = Buffer.from('<svg viewBox="0 0 64 64"><path d="M1 1h2"/></svg>')
function archiveWith(files, stateVersion = 14) {
  const manifest = { version: 1, gameVersion: 'x', stateVersion, createdAt: NOW,
    files: Object.fromEntries([...files].map(([name, body]) => [name, { size: body.length, sha256: createHash('sha256').update(body).digest('hex') }])) }
  return makeZip([...files, ['backup.json', Buffer.from(JSON.stringify(manifest))]])
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'piggy-save-archive-')), statePath = join(root, 'custom-state-name.json')
  const state = { version: 14, name: '团团', xp: 800, coins: 721, extData: { farm: { carrots: 3 }, unknown: { keep: true } }, customSkins: [{ key: 'fox', art: 'custom-fox', label: '狐狸', scenes: REQUIRED_SKIN_SCENES }] }
  writeFileSync(statePath, JSON.stringify(state))
  return { root, statePath, state, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

test('真实 ZIP 往返存档、皮肤、官方扩展和收据，同时排除日志与 WAL', () => {
  const s = setup()
  try {
    mkdirSync(join(s.root, 'skins'), { recursive: true })
    for (const scene of REQUIRED_SKIN_SCENES) writeFileSync(join(s.root, 'skins', `custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`), skinSvg)
    writeFileSync(join(s.root, 'secret.log'), 'bearer=not-exported')
    mkdirSync(join(s.root, 'custom-state-name.json.work-events'))
    writeFileSync(join(s.root, 'custom-state-name.json.work-events', 'receipts.json'), JSON.stringify({ version: 1, receipts: [{ version: 1, source: 'dsh', id: 'm1', type: 'message', at: NOW - 1000, disposition: 'applied' }] }))
    writeFileSync(join(s.root, 'custom-state-name.json.work-events', 'transaction.json'), 'WAL')
    const official = officialList().farm ? 'farm' : Object.keys(officialList())[0]
    const source = join(process.cwd(), 'extensions', official)
    mkdirSync(join(s.root, 'extensions', official), { recursive: true })
    const extManifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8'))
    for (const file of fileList(assetNames(extManifest))) {
      mkdirSync(join(s.root, 'extensions', official, file, '..'), { recursive: true })
      writeFileSync(join(s.root, 'extensions', official, file), readFileSync(join(source, file)))
    }
    mkdirSync(join(s.root, 'extensions', 'custom-code'), { recursive: true })
    writeFileSync(join(s.root, 'extensions', 'custom-code', 'manifest.json'), JSON.stringify({ key: 'custom-code' }))
    writeFileSync(join(s.root, 'extensions', 'custom-code', 'server.js'), 'process.env.TOKEN')
    const exported = createSaveArchive({ statePath: s.statePath, state: s.state, gameVersion: '0.37.1', nowMs: NOW })
    assert.equal(exported.buffer.readUInt32LE(0), 0x04034b50)
    assert.match(exported.name, /^piggy-save-\d{8}-\d{4}\.zip$/)
    const parsed = parseSaveArchive(exported.buffer, { nowMs: NOW })
    assert.equal(parsed.state.coins, 721)
    assert.deepEqual(parsed.state.extData.unknown, { keep: true })
    assert(parsed.files.has(`extensions/${official}/server.js`))
    assert(parsed.files.has('skins/custom-fox.svg'))
    assert.equal(JSON.parse(parsed.files.get('state.json').toString()).version, STATE_VERSION)
    assert(parsed.files.has('state.json.work-events/receipts.json'))
    assert(!parsed.files.has(`extensions/${official}/local.json`))
    assert(parsed.warnings.some(w => w.includes('unknown')))
    assert(!parsed.files.has('extensions/custom-code/server.js'))
    const entries = readZip(exported.buffer)
    assert(!entries.has('secret.log'))
    assert(!entries.has('custom-state-name.json.work-events/transaction.json'))
  } finally { s.cleanup() }
})

test('兼容旧 JSON 并拒绝 future state 与损坏 JSON/ZIP', () => {
  const legacy = parseSaveArchive(Buffer.from(JSON.stringify({ name: '旧猪', version: 14, coins: 99 })), { nowMs: NOW })
  assert.equal(legacy.summary.legacy, true)
  assert.equal(legacy.summary.createdAt, null)
  assert.equal(legacy.state.coins, 99)
  assert.equal(JSON.parse(legacy.files.get('state.json').toString()).version, STATE_VERSION)
  assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify({ version: 999 })), { nowMs: NOW }), /高于当前/)
  assert.throws(() => parseSaveArchive(Buffer.from('{broken'), { nowMs: NOW }), /ZIP|JSON/)
  const zip = createSaveArchive({ statePath: '/tmp/a.json', state: { version: 14 }, nowMs: NOW }).buffer
  const corrupt = Buffer.from(zip); corrupt[40] ^= 0xff
  assert.throws(() => parseSaveArchive(corrupt, { nowMs: NOW }))
  const empty = parseSaveArchive(createSaveArchive({ statePath: '/tmp/empty.json', state: null, nowMs: NOW }).buffer, { nowMs: NOW })
  assert.equal(empty.state, null)
  assert.equal(empty.summary.name, '未孵化')
  assert.throws(() => parseSaveArchive(Buffer.from('null'), { nowMs: NOW }))
})

test('旧 JSON 摘要明确提示缺少扩展程序和自定义皮肤图片', () => {
  const legacy = parseSaveArchive(Buffer.from(JSON.stringify({ version: 14, extData: { farm: {} },
    customSkins: [{ key: 'fox', art: 'custom-fox' }] })), { nowMs: NOW })
  assert(legacy.warnings.some(w => w.includes('farm') && w.includes('缺少程序文件')))
  assert(legacy.warnings.some(w => w.includes('fox') && w.includes('缺少图片')))
})

test('拒绝真实导出 ZIP 里的 backup.json 清单，不让它变成默认小猪', () => {
  const state = Buffer.from(JSON.stringify({ version: STATE_VERSION, name: '团团', coins: 678, hatched: true }))
  const manifest = Buffer.from(JSON.stringify({ version: 1, gameVersion: '0.37.2-rc.5', stateVersion: STATE_VERSION,
    mergeRulesVersion: 1, createdAt: NOW,
    files: { 'state.json': { size: state.length, sha256: createHash('sha256').update(state).digest('hex') } } }))
  assert.throws(() => parseSaveArchive(manifest, { nowMs: NOW }), /不是可识别的小猪存档.*backup\.json/)
  // 同一份清单在完整 ZIP 里是正常的；只有单独选中清单文件时才拒绝。
  const parsed = parseSaveArchive(makeZip([['state.json', state], ['backup.json', manifest]]), { nowMs: NOW })
  assert.equal(parsed.state.coins, 678)
  assert.equal(parsed.state.name, '团团')
})

test('拒绝空对象、窗口/代理配置、安装器回执和扩展包等非存档 JSON', () => {
  const documents = [
    {},
    { width: 800, height: 600, x: 12, y: 34, scale: 1 },
    { mode: 'system', enabled: true },
    { port: 3190, token: 'x'.repeat(32) },
    { version: 1, batch: 'a'.repeat(64), done: [] },
    { format: 'dsh-piggy-extension', key: 'farm', version: '1.0.0', files: { 'manifest.json': '{}' } },
  ]
  for (const document of documents) {
    assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify(document)), { nowMs: NOW }), /不是可识别的小猪存档/, JSON.stringify(document))
  }
})

test('单个通用字段（skin/stage/work/daily/seed）的设置或回执不再补成500金币默认猪', () => {
  const documents = [
    { version: 1, skin: 'dark' },
    { version: 1, stage: 'complete' },
    { version: 1, work: { mode: 'night' } },
    { version: 1, daily: { checked: true } },
    { version: 1, seed: 42 },
    { version: 1, coins: 500 },
    { version: 1, coins: 500, skin: 'dark' },
    { version: 1, coins: 500, daily: { checked: true } },
    { version: 1, name: '设置', skin: 'dark' },
    { version: 1, skin: 'dark', stage: 'complete', form: 'x' },
    { version: 1, personality: 'cranky', motto: '早睡早起' },
  ]
  for (const document of documents) {
    assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify(document)), { nowMs: NOW }), /不是可识别的小猪存档/, JSON.stringify(document))
  }
})

test('可识别的历史 JSON、新建猪和未知字段继续按原有版本规则迁移', () => {
  const v1 = parseSaveArchive(Buffer.from(JSON.stringify({ version: 1, name: '大花', bornAt: NOW, xp: 200,
    weightG: 5000, satiety: 50, happiness: 50, lastSeenAt: NOW })), { nowMs: NOW })
  assert.equal(v1.state.version, STATE_VERSION)
  assert.equal(v1.state.name, '大花')
  assert.equal(v1.state.coins, 500)
  const v3 = parseSaveArchive(Buffer.from(JSON.stringify({ version: 3, name: '老三',
    work: { job: 'site', startedAt: NOW - 60_000, endsAt: NOW }, lastSeenAt: NOW })), { nowMs: NOW })
  assert.equal(v3.state.version, STATE_VERSION)
  assert.equal(v3.state.name, '老三')
  const partial = parseSaveArchive(Buffer.from(JSON.stringify({ name: '旧猪', version: 14, coins: 99 })), { nowMs: NOW })
  assert.equal(partial.state.coins, 99)
  // 新建但还没拆盒的猪也是合法存档，不能被识别规则挡掉。
  const unhatched = parseSaveArchive(Buffer.from(JSON.stringify(layEgg(NOW))), { nowMs: NOW })
  assert.equal(unhatched.state.hatched, false)
  assert.equal(unhatched.state.coins, 500)
  const full = { ...hatchEgg(NOW), coins: 12345, name: '豆豆', mysteryField: { keep: true } }
  const parsed = parseSaveArchive(Buffer.from(JSON.stringify(full)), { nowMs: NOW })
  assert.equal(parsed.state.coins, 12345)
  assert.equal(parsed.state.name, '豆豆')
  assert.deepEqual(parsed.state.mysteryField, { keep: true })
  assert.equal(JSON.parse(parsed.files.get('state.json').toString()).coins, 12345)
})

test('仓库里的真实 v7 存档（state-v7-real.json）仍然通过识别并原样迁移', () => {
  const v7 = JSON.parse(readFileSync(new URL('./fixtures/state-v7-real.json', import.meta.url), 'utf8'))
  assert.equal(v7.version, 7)
  const parsed = parseSaveArchive(Buffer.from(JSON.stringify(v7)), { nowMs: NOW })
  assert.equal(parsed.state.version, STATE_VERSION)
  assert.equal(parsed.state.name, v7.name)
  assert.equal(parsed.state.coins, v7.coins)
  assert.equal(parsed.state.hatched, true)
  assert.deepEqual(parsed.state.inventory, v7.inventory)
  assert.deepEqual(parsed.state.traits, v7.traits)
  assert.equal(parsed.state.stats.jobs, v7.stats.jobs)
  assert.equal(parsed.state.memories.length, v7.memories.length)
})

test('ZIP 里的 state.json 使用同一套识别规则，正常 v15 存档保留原值', () => {
  assert.throws(() => parseSaveArchive(archiveWith(new Map([['state.json', Buffer.from('{}')]]), 0), { nowMs: NOW }), /不是可识别的小猪存档/)
  const packet = Buffer.from(JSON.stringify({ format: 'dsh-piggy-extension', key: 'farm', files: {} }))
  assert.throws(() => parseSaveArchive(archiveWith(new Map([['state.json', packet]]), 0), { nowMs: NOW }), /扩展包/)
  const manifestState = Buffer.from(JSON.stringify({ version: 1, gameVersion: 'x', stateVersion: 1, createdAt: NOW, files: {} }))
  assert.throws(() => parseSaveArchive(archiveWith(new Map([['state.json', manifestState]]), 1), { nowMs: NOW }), /backup\.json/)
  const state = Buffer.from(JSON.stringify({ version: STATE_VERSION, name: '豆豆', coins: 12345, hatched: true }))
  const parsed = parseSaveArchive(archiveWith(new Map([['state.json', state]]), STATE_VERSION), { nowMs: NOW })
  assert.equal(parsed.state.coins, 12345)
  assert.equal(parsed.state.name, '豆豆')
})

test('拒绝 ZIP 路径越界和未知文件', () => {
  const state = Buffer.from(JSON.stringify({ version: 14 }))
  assert.throws(() => parseSaveArchive(archiveWith(new Map([['../escape', Buffer.from('x')], ['state.json', state]])), { nowMs: NOW }), /路径/)
  assert.throws(() => parseSaveArchive(archiveWith(new Map([['readme.txt', Buffer.from('x')], ['state.json', state]])), { nowMs: NOW }), /校验/)
})

test('拒绝皮肤中的恶意 SVG 和损坏 PNG', () => {
  const state = Buffer.from(JSON.stringify({ version: 14, customSkins: [{ key: 'fox', art: 'custom-fox', label: '狐狸', scenes: REQUIRED_SKIN_SCENES }] }))
  const entries = new Map([['state.json', state]])
  for (const scene of REQUIRED_SKIN_SCENES) entries.set(`skins/custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`, skinSvg)
  entries.set('skins/custom-fox.svg', Buffer.from('<svg viewBox="0 0 64 64"><script>alert(1)</script></svg>'))
  assert.throws(() => parseSaveArchive(archiveWith(entries), { nowMs: NOW }), /皮肤.*无效/)
  entries.delete('skins/custom-fox.svg')
  entries.set('skins/custom-fox.png', Buffer.from('not a png'))
  assert.throws(() => parseSaveArchive(archiveWith(entries), { nowMs: NOW }), /皮肤.*无效/)
})

test('拒绝虽匹配自定义皮肤前缀、但没有被场景验证器检查的图片', () => {
  const state = Buffer.from(JSON.stringify({ version: 14, customSkins: [{ key: 'fox', art: 'custom-fox', label: '狐狸', scenes: REQUIRED_SKIN_SCENES }] }))
  const entries = new Map([['state.json', state]])
  for (const scene of REQUIRED_SKIN_SCENES) entries.set(`skins/custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`, skinSvg)
  entries.set('skins/custom-foxevil.svg', Buffer.from('<svg viewBox="0 0 64 64"><script>bad()</script></svg>'))
  assert.throws(() => parseSaveArchive(archiveWith(entries), { nowMs: NOW }), /未登记或未校验/)
})

test('存档总展开体积校验包含 backup.json 清单本身', () => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-save-limit-'))
  try {
    const skins = Array.from({ length: 68 }, (_, index) => {
      const key = `skin-${index}`, art = `custom-${key}`
      return { key, art, label: key, scenes: REQUIRED_SKIN_SCENES }
    })
    const body = Buffer.from(`<svg viewBox="0 0 64 64"><!--${'x'.repeat(96 * 1024 - 43)}--></svg>`)
    assert(body.length <= 96 * 1024)
    mkdirSync(join(root, 'skins'))
    for (const skin of skins) for (const scene of REQUIRED_SKIN_SCENES) {
      writeFileSync(join(root, 'skins', `${skin.art}${scene === 'idle' ? '' : '-' + scene}.svg`), body)
    }

    const statePath = join(root, 'state.json'), state = { version: 14, name: 'big', customSkins: skins, filler: 'x'.repeat(90_000) }
    const stateBytes = Buffer.from(JSON.stringify(state)), files = new Map([['state.json', stateBytes]])
    for (const skin of skins) for (const scene of REQUIRED_SKIN_SCENES) {
      files.set(`skins/${skin.art}${scene === 'idle' ? '' : '-' + scene}.svg`, body)
    }
    const manifest = { version: 1, gameVersion: '', stateVersion: 14, createdAt: NOW,
      files: Object.fromEntries([...files].map(([name, value]) => [name, { size: value.length, sha256: createHash('sha256').update(value).digest('hex') }])) }
    const manifestBytes = Buffer.from(JSON.stringify(manifest))
    assert([...files.values()].reduce((sum, value) => sum + value.length, 0) <= 32 * 1024 * 1024)
    assert([...files.values()].reduce((sum, value) => sum + value.length, 0) + manifestBytes.length > 32 * 1024 * 1024)
    assert.throws(() => createSaveArchive({ statePath, state, gameVersion: '', nowMs: NOW }), /备份上限/)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('存在损坏或异常 receipts 路径时拒绝导出，不丢失去重记录', { skip: process.platform === 'win32' }, () => {
  const s = setup()
  try {
    mkdirSync(`${s.statePath}.work-events`)
    const target = join(s.root, 'receipts-target.json')
    writeFileSync(target, JSON.stringify({ version: 1, receipts: [] }))
    symlinkSync(target, join(`${s.statePath}.work-events`, 'receipts.json'))
    assert.throws(() => createSaveArchive({ statePath: s.statePath, state: s.state, nowMs: NOW }), /工作收据无效/)
  } finally { s.cleanup() }
})

test('超限 receipts 文件拒绝导出', () => {
  const s = setup()
  try {
    mkdirSync(`${s.statePath}.work-events`)
    const receiptsPath = join(`${s.statePath}.work-events`, 'receipts.json')
    writeFileSync(receiptsPath, '{}')
    truncateSync(receiptsPath, 8 * 1024 * 1024 + 1)
    assert.throws(() => createSaveArchive({ statePath: s.statePath, state: s.state, nowMs: NOW }), /超过大小上限/)
  } finally { s.cleanup() }
})

test('ZIP 解码拒绝符号链接、重复路径、解压炸弹和损坏边界', () => {
  const state = Buffer.from(JSON.stringify({ version: 14 }))
  const duplicate = makeZip([['state.json', state], ['state.json', state]])
  assert.throws(() => readZip(duplicate), /重复/)
  const symlink = makeZip([['state.json', state]])
  const centralAt = symlink.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  symlink.writeUInt32LE(((0o120777 << 16) >>> 0), centralAt + 38)
  assert.throws(() => readZip(symlink), /不安全/)
  const bomb = makeZip([['large', Buffer.alloc(4096, 65)]])
  assert.throws(() => readZip(bomb, { maxFileBytes: 128 }), /太大/)
  const badEocd = Buffer.concat([makeZip([['state.json', state]]), Buffer.from('trailing')])
  assert.throws(() => readZip(badEocd), /目录无效/)
})

test('带可选场景的完整皮肤不误报缺图，缺必需场景的图片要报', () => {
  const skin = { key: 'fox', art: 'custom-fox', label: '狐狸', scenes: SKIN_SCENES }
  const state = Buffer.from(JSON.stringify({ version: 14, customSkins: [skin] }))
  const file = scene => `skins/custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`

  // 完整皮肤（含 fish、sleep 等可选场景）不该被说成“缺少图片”。
  const complete = new Map([['state.json', state]])
  for (const scene of SKIN_SCENES) complete.set(file(scene), skinSvg)
  const parsedComplete = parseSaveArchive(archiveWith(complete), { nowMs: NOW })
  assert.deepEqual(parsedComplete.warnings, [])
  assert.equal(parsedComplete.state.customSkins.length, 1)

  // 文件总数刚好等于必需场景数，但缺了 pet、多了 fish：不能因此漏报。
  const missingRequired = new Map([['state.json', state]])
  for (const scene of ['idle', 'eat', 'bathe', 'play', 'fish']) missingRequired.set(file(scene), skinSvg)
  const parsedMissing = parseSaveArchive(archiveWith(missingRequired), { nowMs: NOW })
  assert.equal(parsedMissing.state.customSkins.length, 1, '缺图但场景登记完整时，皮肤记录仍会保留')
  assert(parsedMissing.warnings.some(w => w.includes('fox') && w.includes('缺少图片')), '缺少 pet 图必须提示')
})

test('导出文件名使用本地时间而不是 UTC', { skip: process.platform === 'win32' }, () => {
  const previous = process.env.TZ
  process.env.TZ = 'Asia/Shanghai'
  try {
    const nowMs = Date.UTC(2026, 9, 17, 14, 30)
    const archive = createSaveArchive({ statePath: '/tmp/state.json', state: { version: 14 }, nowMs })
    assert.equal(archive.name, 'piggy-save-20261017-2230.zip')
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})

test('皮肤图片必须属于迁移后仍存在的皮肤记录', () => {
  const state = withSkin => Buffer.from(JSON.stringify({ version: 14, customSkins: [withSkin] }))
  const file = scene => `skins/custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`

  // art 和 key 对不上：迁移会把 art 改成 custom-fox，图片却还在 custom-other，导入后只剩记录。
  const mismatched = new Map([['state.json', state({ key: 'fox', art: 'custom-other', label: '狐狸', scenes: REQUIRED_SKIN_SCENES })]])
  for (const scene of REQUIRED_SKIN_SCENES) mismatched.set(`skins/custom-other${scene === 'idle' ? '' : '-' + scene}.svg`, skinSvg)
  assert.throws(() => parseSaveArchive(archiveWith(mismatched), { nowMs: NOW }), /皮肤/)

  // 场景登记缺少必需场景：迁移会丢掉整条皮肤记录，不能把图片当孤儿写进去。
  const dropped = new Map([['state.json', state({ key: 'fox', art: 'custom-fox', label: '狐狸', scenes: REQUIRED_SKIN_SCENES.filter(scene => scene !== 'pet') })]])
  for (const scene of REQUIRED_SKIN_SCENES.filter(scene => scene !== 'pet')) dropped.set(file(scene), skinSvg)
  assert.throws(() => parseSaveArchive(archiveWith(dropped), { nowMs: NOW }), /皮肤/)

  // 两条记录共用一个 art：迁移后其中一条会指向不存在的图片，不能只看 art 集合。
  const shared = new Map([['state.json', Buffer.from(JSON.stringify({ version: 14, customSkins: [
    { key: 'a', art: 'custom-b', label: 'A', scenes: REQUIRED_SKIN_SCENES },
    { key: 'b', art: 'custom-b', label: 'B', scenes: REQUIRED_SKIN_SCENES },
  ] }))]])
  for (const scene of REQUIRED_SKIN_SCENES) shared.set(`skins/custom-b${scene === 'idle' ? '' : '-' + scene}.svg`, skinSvg)
  assert.throws(() => parseSaveArchive(archiveWith(shared), { nowMs: NOW }), /皮肤/)
})

test('畸形 customSkins 不会让预览抛 TypeError', () => {
  const state = Buffer.from(JSON.stringify({ version: 14, customSkins: [null, 42] }))
  const parsed = parseSaveArchive(archiveWith(new Map([['state.json', state]])), { nowMs: NOW })
  assert.deepEqual(parsed.state.customSkins, [])
})

test('旧 JSON 的畸形 customSkins 不会让预览抛 TypeError', () => {
  const parsed = parseSaveArchive(Buffer.from(JSON.stringify({ version: 14, name: '团团', coins: 721, customSkins: 42 })), { nowMs: NOW })
  assert.equal(parsed.state.coins, 721)
  assert.deepEqual(parsed.state.customSkins, [])
})

test('畸形 customSkins 单独出现时不再被当成存档', () => {
  const documents = [
    { version: 14, customSkins: 42 },
    { version: 14, customSkins: null },
    { version: 14, customSkins: '不是皮肤列表' },
    { version: 14, customSkins: { fox: { key: 'fox' } } },
  ]
  for (const document of documents) {
    assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify(document)), { nowMs: NOW }), /不是可识别的小猪存档/, JSON.stringify(document))
  }
})

test('真实存档字段加畸形 customSkins 仍然正常迁移并清洗皮肤', () => {
  for (const customSkins of [42, null, '不是皮肤列表']) {
    const parsed = parseSaveArchive(Buffer.from(JSON.stringify({ version: 14, name: '团团', coins: 678, hatched: true, customSkins })), { nowMs: NOW })
    assert.equal(parsed.state.name, '团团')
    assert.equal(parsed.state.coins, 678)
    assert.deepEqual(parsed.state.customSkins, [])
  }
})

test('导出畸形 customSkins 不会抛 TypeError', () => {
  const s = setup()
  try {
    const archive = createSaveArchive({ statePath: s.statePath, state: { ...s.state, customSkins: [null] }, nowMs: NOW })
    assert.match(archive.name, /^piggy-save-/)
  } finally { s.cleanup() }
})

test('导出拒绝与资源目录重名的 statePath', () => {
  const root = mkdtempSync(join(tmpdir(), 'piggy-save-layout-'))
  try {
    for (const name of ['skins', 'extensions', 'backups', 'Skins', 'skins.', 'skins ']) {
      assert.throws(() => createSaveArchive({ statePath: join(root, name), state: { version: 14 }, nowMs: NOW }), /重名|不能/)
    }
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('完整包含可选动作的自定义皮肤不会被误报缺少图片', () => {
  const s = setup()
  try {
    const scenes = [...REQUIRED_SKIN_SCENES, 'work']
    s.state.customSkins = [{ key: 'fox', art: 'custom-fox', label: '狐狸', scenes }]
    mkdirSync(join(s.root, 'skins'), { recursive: true })
    for (const scene of scenes) writeFileSync(join(s.root, 'skins', `custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`), skinSvg)
    const exported = createSaveArchive({ statePath: s.statePath, state: s.state, gameVersion: 'x', nowMs: NOW })
    assert.deepEqual(exported.summary.warnings ?? [], [])
    const parsed = parseSaveArchive(exported.buffer, { nowMs: NOW })
    assert(!parsed.warnings.some(warning => warning.includes('皮肤')))
  } finally { s.cleanup() }
})

test('缺少必需动作时即使文件数相同也要提示缺图', () => {
  const s = setup()
  try {
    const scenes = [...REQUIRED_SKIN_SCENES, 'work']
    s.state.customSkins = [{ key: 'fox', art: 'custom-fox', label: '狐狸', scenes }]
    mkdirSync(join(s.root, 'skins'), { recursive: true })
    for (const scene of ['idle', 'eat', 'bathe', 'play', 'work']) {
      writeFileSync(join(s.root, 'skins', `custom-fox${scene === 'idle' ? '' : '-' + scene}.svg`), skinSvg)
    }
    const exported = createSaveArchive({ statePath: s.statePath, state: s.state, gameVersion: 'x', nowMs: NOW })
    assert((exported.summary.warnings ?? []).some(warning => warning.includes('fox') && warning.includes('缺少图片')))
    const parsed = parseSaveArchive(exported.buffer, { nowMs: NOW })
    assert(parsed.warnings.some(warning => warning.includes('fox') && warning.includes('缺少图片')))
  } finally { s.cleanup() }
})

test('皮肤记录里的 art 与 key 不一致时按 key 校验，不导入错名字的图片', () => {
  const state = Buffer.from(JSON.stringify({ version: 14,
    customSkins: [{ key: 'fox', art: 'custom-evil', label: '狐狸', scenes: REQUIRED_SKIN_SCENES }] }))
  const entries = new Map([['state.json', state]])
  for (const scene of REQUIRED_SKIN_SCENES) {
    entries.set(`skins/custom-evil${scene === 'idle' ? '' : '-' + scene}.svg`, skinSvg)
  }
  assert.throws(() => parseSaveArchive(archiveWith(entries), { nowMs: NOW }), /未登记或未校验/)
})

test('损坏的 customSkins 形状只忽略记录，不让预览抛原始 TypeError', () => {
  const legacy = parseSaveArchive(Buffer.from(JSON.stringify({ version: 14, name: '团团', coins: 721,
    customSkins: { fox: { key: 'fox' } } })), { nowMs: NOW })
  assert.deepEqual(legacy.summary.skins, [])
  const zipState = Buffer.from(JSON.stringify({ version: 14, name: '团团', coins: 721, customSkins: 5 }))
  const parsed = parseSaveArchive(archiveWith(new Map([['state.json', zipState]])), { nowMs: NOW })
  assert.deepEqual(parsed.summary.skins, [])
})

test('旧 JSON 的版本号不是整数时拒绝而不是当成旧档迁移', () => {
  assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify({ version: '999', name: '未来猪' })), { nowMs: NOW }), /版本/)
  assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify({ version: 13.5, name: '半档' })), { nowMs: NOW }), /版本/)
})

test('导出的文件名使用本机时间，和预览里的备份时间一致', () => {
  const s = setup()
  try {
    const exported = createSaveArchive({ statePath: s.statePath, state: s.state, gameVersion: 'x', nowMs: NOW })
    const date = new Date(NOW), pad = value => String(value).padStart(2, '0')
    const local = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
    assert.equal(exported.name, `piggy-save-${local}.zip`)
  } finally { s.cleanup() }
})

test('自定义皮肤记录数量超过上限时拒绝，避免恶意存档撑爆快照', () => {
  const customSkins = Array.from({ length: 129 }, (_, index) => ({ key: `skin${index}`, scenes: REQUIRED_SKIN_SCENES }))
  assert.throws(() => parseSaveArchive(Buffer.from(JSON.stringify({ version: 14, customSkins })), { nowMs: NOW }), /皮肤数量/)
  assert.throws(() => parseSaveArchive(archiveWith(new Map([['state.json', Buffer.from(JSON.stringify({ version: 14, customSkins }))]])), { nowMs: NOW }), /皮肤数量/)
  const s = setup()
  try {
    s.state.customSkins = customSkins
    assert.throws(() => createSaveArchive({ statePath: s.statePath, state: s.state, gameVersion: 'x', nowMs: NOW }), /皮肤数量/)
  } finally { s.cleanup() }
})
