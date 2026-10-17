import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createSaveArchive, parseSaveArchive } from '../runtime/save-archive.js'
import { makeZip, readZip } from '../runtime/save-zip.js'
import { officialList } from '../store/ext-import.js'
import { assetNames, fileList } from '../store/ext-files.js'
import { REQUIRED_SKIN_SCENES } from '../packages/pet-core/src/data/skins.js'

const NOW = 1_797_000_000_000
const skinSvg = Buffer.from('<svg viewBox="0 0 64 64"><path d="M1 1h2"/></svg>')
function archiveWith(files) {
  const manifest = { version: 1, gameVersion: 'x', stateVersion: 14, createdAt: NOW,
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
    assert.equal(JSON.parse(parsed.files.get('state.json').toString()).version, 14)
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
  assert.equal(JSON.parse(legacy.files.get('state.json').toString()).version, 14)
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
  const legacy = parseSaveArchive(Buffer.from(JSON.stringify({ version: 14,
    customSkins: { fox: { key: 'fox' } } })), { nowMs: NOW })
  assert.deepEqual(legacy.summary.skins, [])
  const zipState = Buffer.from(JSON.stringify({ version: 14, customSkins: 5 }))
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
