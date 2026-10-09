// @ts-check
/**
 * 更新 App：桌面版可以下载、换版本和回滚；DSH 插件只提示 GitHub 新版本。
 *
 * 版本列表一格一个方块，点一个下面出详情卡（更新说明、能不能换、按钮）。
 * 读写都经过桌面版的 window.piggyShell.updates，不走游戏的路由。
 * @module dsh-piggy/client/tabs/update
 */

import { button, el } from '../dom.js'
import { compareVersions } from '../update-notice.js'

/** One panel per page, so the update state can live here. */
/** @type {any} */
var state = {
  current: null, list: null, error: null, loading: false,
  pick: null, previews: null, busy: null, fraction: 0, message: null, listening: false,
  shellStatus: null, shellBusy: false, shellReady: null, shellFraction: 0, shellMessage: null, shellListening: false,
}

/** The desktop bridge, or null inside DSH. */
export function updatesBridge() {
  var shell = /** @type {any} */ (window).piggyShell
  return shell && shell.updates ? shell : null
}

/** @param {boolean} [fresh] 点了「刷新」：外壳跳过本地缓存去问（仍带 ETag，没变不算次数） */
function refresh(ui, fresh) {
  var shell = updatesBridge()
  if (shell === null || state.loading) return
  state.loading = true
  state.error = null
  if (!state.listening) {
    state.listening = true
    shell.updates.onProgress(function (fraction) { state.fraction = fraction; ui.renderContent() })
  }
  if (shell.shellUpdates && !state.shellListening) {
    state.shellListening = true
    shell.shellUpdates.onProgress(function (fraction) { state.shellFraction = fraction; ui.renderContent() })
  }
  Promise.all([shell.updates.current(), shell.updates.list(fresh === true), shell.shellUpdates ? shell.shellUpdates.status() : null]).then(function (got) {
    state.current = got[0]
    if (got[1] && got[1].ok) state.list = got[1].releases
    else state.error = (got[1] && got[1].reason) || '没问到'
    state.shellStatus = got[2]
  }, function () { state.error = '没问到' }).then(function () {
    state.loading = false
    ui.renderContent()
  })
}

function downloadShell(ui, version) {
  var shell = updatesBridge()
  if (!shell || !shell.shellUpdates || state.shellBusy) return
  state.shellBusy = true
  state.shellFraction = 0
  state.shellMessage = null
  ui.renderContent()
  shell.shellUpdates.download(version).then(function (result) {
    if (result.ok) {
      state.shellReady = result.version
      state.shellMessage = '外壳已下载，重启猪猪后安装。存档会先备份。'
    } else state.shellMessage = result.reason || '外壳下载失败'
    state.shellBusy = false
    ui.renderContent()
  }, function (error) {
    state.shellBusy = false
    state.shellMessage = String(error)
    ui.renderContent()
  })
}

function installShell(ui) {
  var shell = updatesBridge()
  if (!shell || !shell.shellUpdates) return
  shell.shellUpdates.install().then(function (result) {
    if (!result.ok) { state.shellMessage = result.reason; ui.renderContent() }
  })
}

function shellManualReason(mode) {
  if (mode === 'portable') return 'Windows 便携版需要下载并替换旧 EXE。'
  if (mode === 'unsigned-mac') return 'macOS 包暂未签名，无法在应用内自动更新；请下载 DMG 并替换应用。'
  if (mode === 'manual') return '这种 Linux 安装方式需要从发布页下载新包。'
  if (mode === 'preview-manual') return '预览版的桌面外壳要从发布页下载安装包，装一次之后就能在这里直接更新。'
  return '当前版本还不支持应用内更新外壳，需要手动安装一次新版。'
}

function install(ui, version) {
  var shell = updatesBridge()
  if (shell === null) return
  state.busy = version
  state.fraction = 0
  state.message = null
  ui.renderContent()
  shell.updates.install(version).then(function (result) {
    state.message = result.ok ? '换好了，猪马上回来…' : result.reason
    if (!result.ok) state.busy = null
    ui.renderContent()
  })
}

function rollback(ui) {
  var shell = updatesBridge()
  if (shell === null) return
  state.busy = 'rollback'
  ui.renderContent()
  shell.updates.rollback().then(function (result) {
    state.message = result.ok ? '回去了，猪马上回来…' : result.reason
    if (!result.ok) state.busy = null
    ui.renderContent()
  })
}

export function renderUpdateTab(ui) {
  if (updatesBridge() === null) {
    renderDshUpdate(ui)
    return
  }
  if (state.current === null && state.list === null && state.error === null) refresh(ui)
  var cur = state.current
  var head = el('div', 'dp-pick dp-tile-card dp-update-now')
  // 标题行：左边版本，右边刷新按钮。上一版把按钮浮在右上角，压住了版本号（用户 2026-10-05 反馈）。
  var top = el('div', 'dp-update-top')
  top.appendChild(el('div', 'dp-pick-head', cur === null ? '正在看现在的版本…'
    : '游戏 v' + cur.version + (cur.bundled ? '（安装包自带）' : '')))
  head.appendChild(top)
  if (cur !== null) head.appendChild(el('div', 'dp-dim', '桌面外壳 v' + cur.shell + ' · 游戏玩法和窗口功能分别更新'))
  if (state.message !== null) head.appendChild(el('div', 'dp-req', state.message))
  // 刷新：重新问一遍 GitHub 和本机现在的版本（以前没有入口，出错时只能重开面板）。
  var again = button('dp-mini dp-update-refresh', { 'data-update-refresh': '' }, function () {
    state.message = null
    state.shellMessage = null
    refresh(ui, true)
  })
  again.textContent = state.loading ? '正在刷新…' : '🔄 刷新'
  again.disabled = state.loading || state.busy !== null || state.shellBusy
  top.appendChild(again)
  // 只推荐正式版（G 批次）：「更新到最新」、外壳提示、红点都只看正式版；测试版只能在下面的列表里自己点开安装。
  var eligible = function (r) { return !r.prerelease }
  // 外壳要不要更新由页面自己比：0.1.x 的旧外壳不会在列表里给 shellUpdate，
  // 以前它们就一直看不到「桌面外壳太旧」的提示（用户 2026-10-04 实测：外壳 v0.1.2）。
  var shellOf = function (r) { return r.latestShell || (r.manifest && r.manifest.shellVersion) || null }
  var shellRelease = state.list === null || cur === null ? null : state.list.find(function (r) {
    return eligible(r) && shellOf(r) !== null && compareVersions(shellOf(r), cur.shell) > 0
  }) || null
  if (shellRelease !== null) {
    var shellVersion = shellOf(shellRelease)
    var mode = state.shellStatus && state.shellStatus.mode
    // 0.2.5 以前的外壳只会在应用内下载**正式版**里的外壳；预览版里的外壳只能去发布页下
    // （用户 2026-10-05 在 0.2.2 上点下载，得到一句「请先刷新版本列表」）。
    if (shellRelease.prerelease && compareVersions(cur.shell, '0.2.5') < 0) mode = 'preview-manual'
    // 只有「不更新就玩不了新版本」时才醒目提示；可选更新只放一行灰字和一个小按钮，
    // 不再红字一直催（用户 2026-10-05：更新页一直在说要下载桌面外壳）。
    var required = compareVersions(cur.shell, '0.2.0') < 0 || state.list.some(function (r) {
      return eligible(r) && r.blocked === 'shell' && compareVersions(r.version, cur.version) > 0
    })
    head.appendChild(el('div', required ? 'dp-req' : 'dp-dim', required
      ? '桌面外壳 v' + cur.shell + ' → v' + shellVersion + '：新版本游戏需要它'
      : '桌面外壳有可选更新 v' + shellVersion + '，不更新也能正常玩'))
    if (compareVersions(cur.shell, '0.2.0') < 0) head.appendChild(el('div', 'dp-dim', '你的桌面外壳是铺满全屏的旧版，会卡、会闪；新外壳只框住猪和面板。请下载新安装包覆盖安装，存档不会丢。'))
    if (mode !== 'automatic' && required) head.appendChild(el('div', 'dp-dim', shellManualReason(mode)))
    if (state.shellMessage !== null) head.appendChild(el('div', 'dp-req', state.shellMessage))
    if (state.shellBusy) head.appendChild(el('div', 'dp-dim', '正在下载桌面外壳 ' + Math.round(state.shellFraction * 100) + '%'))
    var shellGo = button(required ? 'dp-btn dp-btn-wide' : 'dp-mini', { 'data-update-shell': shellRelease.version }, function () {
      if (mode !== 'automatic') updatesBridge().openPage(shellRelease.page)
      else if (state.shellReady === shellVersion) installShell(ui)
      else downloadShell(ui, shellVersion)
    })
    shellGo.textContent = mode !== 'automatic' ? '打开发布页下载' : state.shellReady === shellVersion ? '重启并安装桌面外壳' : '下载桌面外壳 v' + shellVersion
    shellGo.disabled = state.shellBusy || state.busy !== null
    head.appendChild(shellGo)
  }
  if (state.busy !== null && state.message === null) {
    head.appendChild(el('div', 'dp-dim', state.busy === 'rollback' ? '正在换回去…' : '下载中 ' + Math.round(state.fraction * 100) + '%'))
  }
  var latest = state.list === null ? null : state.list.find(function (r) { return r.blocked === null && eligible(r) }) || null
  // 现在用的比列表里最新的还新（比如在用预览版）就别再叫人「更新」到旧版本。
  if (latest !== null && cur !== null && compareVersions(latest.version, cur.version) > 0) {
    var up = button('dp-btn dp-btn-wide', { 'data-update-latest': latest.version }, function () { install(ui, latest.version) })
    up.textContent = '⬆️ 更新到最新 v' + latest.version
    up.disabled = state.busy !== null
    head.appendChild(up)
  } else if (latest !== null) {
    head.appendChild(el('div', 'dp-req dp-req-ok', '✓ 已经是最新'))
  }
  ui.content.appendChild(head)

  if (state.loading && state.list === null) ui.content.appendChild(el('div', 'dp-empty', '正在问 GitHub…'))
  if (state.error !== null) {
    ui.content.appendChild(el('div', 'dp-empty', state.error))
    var again = button('dp-btn dp-btn-wide', { 'data-update-retry': '' }, function () { refresh(ui, true) })
    again.textContent = '再试一次'
    ui.content.appendChild(again)
  }
  if (state.list !== null) renderList(ui, state.list)

  if (cur !== null && cur.previous !== null) {
    var back = button('dp-btn dp-btn-wide dp-update-back', { 'data-update-rollback': '' }, function () { rollback(ui) })
    back.textContent = '↩️ 回到上一个版本 v' + cur.previous
    back.disabled = state.busy !== null
    ui.content.appendChild(back)
  }
}

/** DSH cannot replace plugin files safely; it only points to the new release. */
function renderDshUpdate(ui) {
  var notice = ui.updateNotice
  var head = el('div', 'dp-pick dp-tile-card dp-update-now')
  head.appendChild(el('div', 'dp-pick-head', '现在 v' + (ui.view.version || '未知')))
  head.appendChild(el('div', 'dp-dim', 'DSH 插件只提醒新版本，不会自动改动本地文件。'))
  ui.content.appendChild(head)
  if (notice === null || notice === undefined) return
  if (!notice.checked && !notice.checking && notice.error === null) notice.check()
  if (notice.checking) {
    ui.content.appendChild(el('div', 'dp-empty', '正在问 GitHub…'))
    return
  }
  if (notice.error !== null) {
    ui.content.appendChild(el('div', 'dp-empty', notice.error))
    var retry = button('dp-btn dp-btn-wide', { 'data-update-retry': '' }, function () { notice.check() })
    retry.textContent = '再试一次'
    ui.content.appendChild(retry)
    return
  }
  var release = notice.remote
  if (release === null) return
  if (notice.latest === null) {
    ui.content.appendChild(el('div', 'dp-req dp-req-ok', '✓ 已经是最新'))
    return
  }
  var box = el('div', 'dp-pick dp-tile-card dp-update-detail')
  box.appendChild(el('div', 'dp-pick-head', '发现新版本 v' + release.version))
  if (release.notes) box.appendChild(el('div', 'dp-update-notes', release.notes))
  var go = button('dp-btn dp-btn-wide', { 'data-update-page': release.version }, function () {
    window.open(release.page, '_blank', 'noopener')
  })
  go.textContent = '打开发布页'
  box.appendChild(go)
  ui.content.appendChild(box)
}

/** 测试版归到它对应的正式版下面：0.28.0-rc.2 → 0.28.0。 */
function baseOf(version) {
  return String(version).split('-')[0]
}

/**
 * 按正式版分组的版本列表（G 批次）：每个正式版一行，点开看说明和按钮；
 * 它的测试版收在组里默认折叠，标「测试版 · 手动安装」。还没发正式版的测试版自成一组。
 */
function renderList(ui, list) {
  if (list.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', 'GitHub 上还没有能热更新的版本'))
    return
  }
  var groups = []
  var byBase = {}
  for (var i = 0; i < list.length; i += 1) {
    var release = list[i]
    var base = baseOf(release.version)
    if (byBase[base] === undefined) { byBase[base] = { base: base, stable: null, previews: [] }; groups.push(byBase[base]) }
    if (release.prerelease) byBase[base].previews.push(release)
    else byBase[base].stable = release
  }
  groups.sort(function (a, b) { return compareVersions(b.base, a.base) })
  var newestStable = list.find(function (r) { return !r.prerelease && r.blocked === null }) || null
  for (var g = 0; g < groups.length; g += 1) renderGroup(ui, groups[g], newestStable)
}

function renderGroup(ui, group, newestStable) {
  var key = group.base
  var head = group.stable ?? group.previews[0]
  var open = state.pick === key
  var box = el('div', 'dp-rel')
  box.setAttribute('data-release-group', key)
  var row = button('dp-rel-head', { 'data-release': head.version }, function () { state.pick = open ? null : key; ui.renderContent() })
  row.appendChild(el('b', null, 'v' + key))
  row.appendChild(el('small', null, group.stable !== null ? group.stable.date : '还没发正式版'))
  var tags = el('span', 'dp-rel-tags')
  var current = (group.stable !== null && group.stable.current) || group.previews.some(function (r) { return r.current })
  if (current) tags.appendChild(tag('current', '在用'))
  if (group.stable !== null && newestStable !== null && group.stable.version === newestStable.version) tags.appendChild(tag('latest', '最新'))
  if (group.stable !== null && group.stable.blocked !== null) tags.appendChild(tag('blocked', '🔒'))
  row.appendChild(tags)
  box.appendChild(row)
  if (open) {
    var body = el('div', 'dp-rel-body')
    if (group.stable !== null) body.appendChild(details(ui, group.stable))
    if (group.previews.length > 0) {
      var pre = el('div', 'dp-rel-pre')
      var showing = state.previews === key
      var toggle = button('dp-mini dp-mini-plain', { 'data-previews': key }, function () { state.previews = showing ? null : key; ui.renderContent() })
      toggle.textContent = (showing ? '▾ ' : '▸ ') + '测试版 ' + group.previews.length + ' 个 · 手动安装'
      pre.appendChild(toggle)
      if (showing) {
        for (var p = 0; p < group.previews.length; p += 1) pre.appendChild(previewRow(ui, group.previews[p]))
      }
      body.appendChild(pre)
    }
    box.appendChild(body)
  }
  ui.content.appendChild(box)
}

function tag(kind, text) {
  var node = el('span', 'dp-rel-tag', text)
  node.setAttribute('data-tag', kind)
  return node
}

/** 一个测试版：版本、日期、手动安装按钮（不推荐，所以只是一个小按钮）。 */
function previewRow(ui, release) {
  var row = el('div', 'dp-rel-pre-row')
  row.appendChild(el('span', null, 'v' + release.version + (release.date ? ' · ' + release.date : '')))
  var go = button('dp-mini', { 'data-update-install': release.version }, function () {
    if (release.blocked === 'shell') updatesBridge().openPage(release.page)
    else install(ui, release.version)
  })
  go.textContent = release.current ? '正在用' : release.blocked === 'shell' ? '需要新外壳' : release.blocked === 'save' ? '换不了' : '安装测试版'
  go.disabled = release.current || release.blocked === 'save' || state.busy !== null
  row.appendChild(go)
  return row
}

function details(ui, release) {
  var box = el('div', 'dp-pick dp-tile-card dp-update-detail')
  box.appendChild(el('div', 'dp-pick-head', 'v' + release.version + (release.date ? ' · ' + release.date : '') + (release.prerelease ? ' · 预览版' : '')))
  if (release.notes) box.appendChild(el('div', 'dp-update-notes', release.notes))
  var go = button('dp-btn dp-btn-wide', { 'data-update-install': release.version }, function () {
    if (release.blocked === 'shell') updatesBridge().openPage(release.page)
    else install(ui, release.version)
  })
  if (release.current) {
    go.textContent = '正在用这个'
    go.disabled = true
  } else if (release.blocked === 'shell') {
    box.appendChild(el('div', 'dp-req', '✗ 游戏 v' + release.version + ' 要求桌面外壳至少 v' + release.minShell))
    go.textContent = state.shellStatus && state.shellStatus.mode === 'automatic' ? '先更新上面的桌面外壳' : '去下载新安装包'
    if (state.shellStatus && state.shellStatus.mode === 'automatic') go.disabled = true
  } else if (release.blocked === 'save') {
    box.appendChild(el('div', 'dp-req', '✗ 存档太新，这个版本读不了'))
    go.textContent = '换不了'
    go.disabled = true
  } else {
    go.textContent = '换到这个版本'
    go.disabled = state.busy !== null
  }
  box.appendChild(go)
  return box
}
