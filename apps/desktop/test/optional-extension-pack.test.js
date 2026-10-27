// @ts-check
/**
 * Windows 安装器可选扩展的打包契约（2026-10-27）。
 *
 * 守住的规矩（docs/design/windows-optional-extensions-20261027.md）：
 * - 五个官方扩展用现有 extensionFiles/makeBundle 打成运行时能拆的 .piggyext，catalog 带 sha256；
 * - NSIS 页面在目录页之后，五个复选框默认不勾；silent 不自动选，也不恢复上次选择；
 * - customInstall 只写 $INSTDIR\resources\optional-extensions（catalog + 选中的包 + selection.json），
 *   空选写空数组，每次覆盖；不碰 APPDATA/存档/已有扩展；
 * - 经典菜园变体不进安装器；
 * - electron-builder.optional.cjs 只加必要项，不接管整份 installer.nsi、不关图标/资源编辑/卸载。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import {
  DESKTOP_DIR, GENERATED_NSH, PAGE_STRINGS,
  buildOptionalExtensions, nsisString,
} from '../scripts/pack-optional-extensions.mjs'
import { parseBundle } from '../../../store/ext-import.js'

const require = createRequire(import.meta.url)
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const KEYS = ['farm', 'mine', 'blindbox', 'gacha', 'pig-puzzle']

/** @type {string} */
let work
/** @type {ReturnType<typeof buildOptionalExtensions>} */
let built

before(() => {
  work = mkdtempSync(join(tmpdir(), 'piggy-optional-extensions-'))
  built = buildOptionalExtensions({
    outDir: join(work, 'optional-extensions'),
    generatedDir: work,
  })
})

after(() => {
  rmSync(work, { recursive: true, force: true })
})

const readManifest = key => JSON.parse(readFileSync(new URL(`../../../extensions/${key}/manifest.json`, import.meta.url), 'utf8'))
const driver = () => readFileSync(join(DESKTOP_DIR, 'build', 'optional-extensions.nsh'), 'utf8')

test('catalog lists the five official extensions in page order with real bundle hashes', () => {
  const catalogPath = join(work, 'optional-extensions', 'catalog.json')
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  assert.equal(catalog.version, 1)
  assert.deepEqual(catalog.items.map(item => item.key), KEYS, 'page order is fixed and farm-classic is not included')
  for (const item of catalog.items) {
    assert.deepEqual(Object.keys(item).sort(), ['file', 'key', 'label', 'sha256', 'version'])
    const manifest = readManifest(item.key)
    assert.equal(item.label, manifest.label)
    assert.equal(item.version, manifest.version)
    assert.equal(item.file, `ext-${item.key}-${item.version}.piggyext`)
    const file = join(work, 'optional-extensions', item.file)
    assert.ok(existsSync(file), item.file)
    assert.equal(sha256(readFileSync(file)), item.sha256, `${item.file} hash matches catalog`)
  }
  assert.ok(!catalog.items.some(item => item.key === 'farm-classic'), 'classic farm stays a manual import variant')
})

test('bundles are the same .piggyext the runtime importer accepts', () => {
  const catalog = built.catalog
  for (const item of catalog.items) {
    const text = readFileSync(join(work, 'optional-extensions', item.file), 'utf8')
    const parsed = parseBundle(text)
    assert.ok(parsed.ok, `${item.key} bundle parses`)
    if (!parsed.ok) continue
    assert.equal(parsed.key, item.key)
    assert.equal(parsed.manifest.version, item.version)
    assert.equal(parsed.manifest.label, item.label)
    for (const name of ['manifest.json', 'server.js', 'client.js']) assert.ok(parsed.files.has(name), `${item.key} has ${name}`)
    const declared = Array.isArray(parsed.manifest.assets) ? parsed.manifest.assets : []
    for (const name of declared) assert.ok(parsed.files.has('assets/' + name), `${item.key} bundle contains ${name}`)
  }
})

test('strings.json carries the page text with English field names only', () => {
  const strings = JSON.parse(readFileSync(join(work, 'optional-extensions', 'strings.json'), 'utf8'))
  assert.deepEqual(Object.keys(strings).sort(), ['builtinNote', 'items', 'keepNote', 'subtitle', 'title', 'updateNote', 'version'])
  assert.equal(strings.title, PAGE_STRINGS.title)
  assert.equal(strings.keepNote, PAGE_STRINGS.keepNote)
  assert.equal(strings.items.length, KEYS.length)
  for (const [index, item] of strings.items.entries()) {
    assert.deepEqual(Object.keys(item).sort(), ['file', 'key', 'label', 'note', 'version'])
    assert.equal(item.key, KEYS[index])
    assert.ok(item.note.length > 0, 'each item has a short note')
    assert.equal(item.file, built.catalog.items[index].file)
  }
  for (const key of Object.keys(strings)) assert.match(key, /^[A-Za-z]+$/, `field name ${key} is English`)
})

test('generated NSIS defines are UTF-8 with BOM and match the catalog', () => {
  const nsh = readFileSync(join(work, GENERATED_NSH), 'utf8')
  assert.ok(nsh.startsWith('\uFEFF'), 'BOM keeps makensis from guessing the code page')
  assert.ok(nsh.includes('!define OPTEXT_ITEM_COUNT 5'))
  for (const [index, item] of built.catalog.items.entries()) {
    assert.ok(nsh.includes(`!define OPTEXT_${index}_KEY ${JSON.stringify(item.key)}`))
    assert.ok(nsh.includes(`!define OPTEXT_${index}_FILE ${JSON.stringify(item.file)}`))
    assert.ok(nsh.includes(item.file))
  }
  assert.ok(nsh.includes(nsisString(PAGE_STRINGS.updateNote)), 'reinstall note is available to the page')
})

test('the NSIS driver is ASCII-only and wires the electron-builder 26.15.3 hooks', () => {
  const source = driver()
  assert.match(source, /^[\x00-\x7F]*$/, 'driver source stays ASCII so makensis encoding never matters')
  assert.ok(source.includes('!include "optional-extensions.generated.nsh"'))
  assert.ok(source.includes('!macro customPageAfterChangeDir') && source.includes('Page custom optExtPageCreate optExtPageLeave'))
  assert.ok(source.includes('!macro customInstall'))
  assert.ok(source.includes('!macro customInit'))
  assert.ok(!source.includes('farm-classic.piggyext'), 'classic farm variant is not bundled')
  assert.ok(!source.includes('extension-variants'), 'no variant folder is read by the installer script')
  assert.ok(!/^\s*!macro customHeader/m.test(source), 'no whole-installer override')
})

test('five checkboxes stay unchecked by default and silent installs never auto-select', () => {
  const source = driver()
  for (let index = 0; index < 5; index += 1) {
    assert.ok(source.includes(`Pop $optExtCb${index}`), `checkbox ${index} exists`)
    assert.ok(source.includes(`\${NSD_GetState} $optExtCb${index} $0`), `checkbox ${index} is read on leave`)
  }
  assert.equal((source.match(/NSD_SetState/g) ?? []).length, 5, 'back navigation restores this wizard selection only')
  assert.ok(!/IfSilent[\s\S]{0,120}StrCpy \$optExtSel[0-4] "1"/.test(source), 'silent install must not select items')
  const init = source.slice(source.indexOf('!macro customInit'), source.indexOf('!macroend', source.indexOf('!macro customInit')))
  for (let index = 0; index < 5; index += 1) assert.ok(init.includes(`StrCpy $optExtSel${index} ""`), `customInit clears selection ${index}`)
})

test('customInstall only writes the app resources folder and never user data', () => {
  const source = driver()
  const install = source.slice(source.indexOf('!macro customInstall'), source.indexOf('!macroend', source.indexOf('!macro customInstall')))
  assert.ok(install.includes('RMDir /r "${OPTEXT_TARGET_DIR}"'))
  assert.ok(source.includes('!define OPTEXT_TARGET_DIR "$INSTDIR\\resources\\optional-extensions"'))
  assert.ok(install.includes('File "${OPTEXT_SOURCE_DIR}/catalog.json"'), 'catalog is always placed')
  for (let index = 0; index < 5; index += 1) {
    assert.ok(new RegExp(`\\$\\{If\\} \\$optExtSel${index} == "1"\\s*\\n\\s*File "\\$\\{OPTEXT_SOURCE_DIR\\}/\\$\\{OPTEXT_${index}_FILE\\}"`).test(install),
      `bundle ${index} is only extracted when checked`)
  }
  assert.ok(!/\$(APPDATA|PROFILE|LOCALAPPDATA|DOCUMENTS)|\\AppData|\\Documents/i.test(install), 'no user data paths in customInstall')
  assert.ok(install.includes("FileWrite $optExtFile '{\"version\":1,\"keys\":[$optExtKeys]}'"), 'selection.json is the runtime contract')
  assert.ok(install.indexOf('FileOpen $optExtFile') > install.indexOf('StrCpy $optExtKeys ""'), 'selection is written on every install')
  assert.ok(install.includes('${If} $optExtKeys != ""\n    StrCpy $optExtKeys $optExtKeys "" 1'), 'empty selection keeps an empty array')
  const order = KEYS.map((key, index) => install.indexOf(`"${'${'}OPTEXT_${index}_KEY}"`))
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'selection keys keep page order')
  assert.ok(install.lastIndexOf('SetOutPath "$INSTDIR"') > install.indexOf('FileClose $optExtFile'), 'restores the install dir')
})

test('the optional config keeps icon/resource editing/uninstaller and only adds the include', () => {
  const base = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).build
  const config = require('../electron-builder.optional.cjs')
  assert.equal(config.appId, base.appId)
  assert.deepEqual(config.win.icon, base.win.icon)
  assert.equal(config.nsis.oneClick, false)
  assert.equal(config.nsis.allowToChangeInstallationDirectory, true)
  assert.equal(config.nsis.artifactName, 'dsh-piggy-setup-${version}.${ext}')
  assert.equal(config.nsis.include, join(DESKTOP_DIR, 'build', 'optional-extensions.nsh'))
  assert.ok(!config.nsis.script, 'never replaces the whole installer.nsi')
  assert.equal(config.signAndEditExecutable, undefined)
  assert.equal(config.win.signAndEditExecutable, undefined)
  assert.deepEqual(config.win.target, ['nsis'])
  assert.deepEqual(config.extraResources.map(entry => entry.to), ['game'], 'full channel still ships the game')
  assert.ok(!config.extraResources.some(entry => String(entry.to).includes('optional-extensions')), 'bundles are embedded by NSIS, not copied verbatim')
  assert.equal(config.toolsets.wine, '1.0.1', 'Linux uninstaller generation uses the official wine toolset')
  assert.deepEqual(require('../scripts/verify-optional-extensions.cjs').KEYS, KEYS)
})

test('beforePack verification accepts fresh artifacts and rejects stale or tampered ones', () => {
  const config = require('../electron-builder.optional.cjs')
  const verify = require('../scripts/verify-optional-extensions.cjs').verifyOptionalExtensions
  assert.equal(typeof verify, 'function')
  const good = {
    dir: join(work, 'optional-extensions'),
    generated: join(work, GENERATED_NSH),
    include: join(DESKTOP_DIR, 'build', 'optional-extensions.nsh'),
  }
  const catalog = verify(good)
  assert.equal(catalog.items.length, 5)

  const broken = join(work, 'broken')
  cpSync(join(work, 'optional-extensions'), broken, { recursive: true })
  cpSync(join(work, GENERATED_NSH), join(work, 'broken.generated.nsh'))
  const brokenPaths = { ...good, dir: broken, generated: join(work, 'broken.generated.nsh') }

  // 1) missing bundle
  rmSync(join(broken, catalog.items[2].file))
  assert.throws(() => verify(brokenPaths), /missing extension bundle/)

  // 2) tampered bundle
  const file = join(broken, catalog.items[2].file)
  writeFileSync(file, 'not the packed bundle')
  assert.throws(() => verify(brokenPaths), /sha256 changed after packing/)

  // 3) stale generated defines
  writeFileSync(file, readFileSync(join(work, 'optional-extensions', catalog.items[2].file)))
  writeFileSync(join(work, 'broken.generated.nsh'), '\uFEFF!define OPTEXT_ITEM_COUNT 5\n')
  assert.throws(() => verify(brokenPaths), /generated NSIS/)

  // 4) strings out of sync
  writeFileSync(join(work, 'broken.generated.nsh'), readFileSync(join(work, GENERATED_NSH)))
  const stringsPath = join(broken, 'strings.json')
  const strings = JSON.parse(readFileSync(stringsPath, 'utf8'))
  strings.items[0].label = 'wrong label'
  writeFileSync(stringsPath, JSON.stringify(strings))
  assert.throws(() => verify(brokenPaths), /strings.json item 0 label/)

  // 5) missing include
  assert.throws(() => verify({ ...good, include: join(work, 'nope.nsh') }), /missing NSIS include/)
})

test('NSIS string escaping cannot break out of a define', () => {
  assert.equal(nsisString('a$b'), '"a$$b"')
  assert.equal(nsisString('say "hi"'), '"say $\\"hi$\\""')
  assert.equal(nsisString('two\r\nlines'), '"two lines"')
})
