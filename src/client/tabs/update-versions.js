// @ts-check
/**
 * DSH 更新页：列出发布页上的正式版和测试版，按版本给出安装命令和发布页链接。
 *
 * DSH 插件不能改写本地文件，所以这里只读发布页（地址由 channel.js 按渠道给），
 * 测试版不参与红点提醒（update-notice.js 只看正式版）；换版本由用户自己复制命令去装。
 * 发布页有标签不等于 npm 有包，所以只有选中某一版时才问一次 npm（update-npm.js），
 * 确认有才给 `dsh-piggy@版本` 的安装命令，没问出来就说没问出来、不猜。
 * @module dsh-piggy/client/tabs/update-versions
 */

import { button, el } from '../dom.js'
import { compareVersions } from '../update-notice.js'
import { fetchNpmVersion } from './update-npm.js'
import { CHANNEL } from '../../../channel.js'

/**
 * One panel, one list: re-entering the tab keeps it; 刷新 asks again.
 * @param {any} ui
 * @returns {any}
 */
function freshState(ui) {
  return {
    ui: ui, releases: null, loading: false, asked: false, error: null, pick: null, previews: false,
    /** 版本 → { state: 'checking'|'found'|'missing'|'error', message? }：只记问过 npm 的这一版。 */
    npm: {},
  }
}

var state = freshState(null)

/** 换页或换面板（测试里换 ui）时整页重来，不把上一个列表带过去。 */
function stateFor(ui) {
  if (state.ui !== ui) state = freshState(ui)
  return state
}

function channelName() {
  return CHANNEL.name === 'gitee' ? 'Gitee' : 'GitHub'
}

/**
 * 发行版标签 → 游戏版本号。扩展发行版是 ext-<key>-<版本>，不是游戏版本，
 * 不能混进版本列表（它们也会出现在同一个发布页里）。
 * @param {unknown} tag
 * @returns {string|null}
 */
export function gameTag(tag) {
  var name = String(tag ?? '')
  var match = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(name)
  return match === null ? null : match[1]
}

/**
 * 发布页返回的数组 → 游戏版本列表，新的在前。草稿和扩展发行版都不收；
 * Gitee 的发行版没有 html_url，按标签拼发布页地址。
 * @param {any} payload
 * @returns {any[]}
 */
export function gameReleases(payload) {
  // 列表接口正常返回数组；单条也照收，免得接口换个形状就整页空白。
  var list = Array.isArray(payload) ? payload : payload !== null && typeof payload === 'object' ? [payload] : []
  var out = []
  for (var i = 0; i < list.length; i += 1) {
    var release = list[i]
    if (release === null || typeof release !== 'object' || release.draft === true) continue
    var version = gameTag(release.tag_name)
    if (version === null) continue
    var tag = String(release.tag_name)
    var date = release.published_at ?? release.created_at ?? ''
    out.push({
      version: version,
      tag: tag,
      date: typeof date === 'string' ? date.slice(0, 10) : '',
      // 有的接口（如 Gitee）可能不带 prerelease 标记，版本号里的 -rc.N 同样算测试版。
      prerelease: release.prerelease === true || version.indexOf('-') !== -1,
      notes: String(release.body ?? '').slice(0, 1200),
      page: String(release.html_url || CHANNEL.releasesPage + '/tag/' + tag),
    })
  }
  out.sort(function (a, b) { return compareVersions(b.version, a.version) })
  return out
}

/**
 * 读发布页列表。网络失败和 HTTP 错误都变成一句能看懂的话，交给页面显示重试。
 * @param {typeof fetch} [doFetch]
 * @returns {Promise<any[]>}
 */
export async function fetchReleases(doFetch = fetch) {
  var response
  try {
    response = await doFetch(CHANNEL.releasesList, { headers: { accept: 'application/vnd.github+json' }, cache: 'no-store' })
  } catch (error) {
    throw new Error('没问到 ' + channelName() + ' 发布页')
  }
  if (!response.ok) throw new Error(channelName() + ' ' + response.status)
  return gameReleases(await response.json())
}

/** @param {any} ui */
function load(ui) {
  var s = stateFor(ui)
  if (s.loading) return
  s.loading = true
  s.error = null
  fetchReleases().then(function (releases) {
    s.releases = releases
  }, function (error) {
    s.error = error instanceof Error ? error.message : '没问到发布页'
  }).then(function () {
    s.loading = false
    s.asked = true
    // 只有还停在更新页时才重画：列表回来得晚，别把用户正在看的别的页签刷回去。
    if (ui.tab === 'update') ui.renderContent()
  })
}

/**
 * DSH 的更新页：现在的版本、正式版提醒，加上发布页上的全部游戏版本。
 * @param {any} ui
 */
export function renderDshUpdate(ui) {
  var s = stateFor(ui)
  if (!s.asked && !s.loading && s.error === null) load(ui)
  renderHead(ui, s)
  renderNotice(ui)
  renderVersions(ui, s)
}

/** @param {any} ui @param {any} s */
function renderHead(ui, s) {
  var head = el('div', 'dp-pick dp-tile-card dp-update-now')
  var top = el('div', 'dp-update-top')
  top.appendChild(el('div', 'dp-pick-head', '现在 v' + (ui.view.version || '未知')))
  var again = button('dp-mini dp-update-refresh', { 'data-dsh-refresh': '' }, function () {
    s.pick = null
    s.previews = false
    // 手动刷新等于重新核对：记住的 npm 答案也一起清掉，下次点开重问。
    s.npm = {}
    load(ui)
    ui.renderContent()
  })
  again.textContent = s.loading ? '正在刷新…' : '🔄 刷新'
  again.disabled = s.loading
  top.appendChild(again)
  head.appendChild(top)
  head.appendChild(el('div', 'dp-dim', 'DSH 插件只提醒新版本，不会自动改动本地文件。'))
  head.appendChild(el('div', 'dp-dim', '测试版不弹提示、也不亮红点；想试哪个版本，在下面点开看这一版怎么装。'))
  ui.content.appendChild(head)
}

/** 正式版提醒沿用原来的样子：只有最新正式版比现在新时才出现。 */
function renderNotice(ui) {
  var notice = ui.updateNotice
  if (notice === null || notice === undefined) return
  if (!notice.checked && !notice.checking && notice.error === null) notice.check()
  if (notice.checking) {
    ui.content.appendChild(el('div', 'dp-empty', '正在问 ' + channelName() + '…'))
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
  if (release.notes) {
    var notes = el('div', 'dp-update-notes', release.notes)
    notes.setAttribute('data-scroll-key', 'update-notes:' + release.version)
    box.appendChild(notes)
  }
  var go = button('dp-btn dp-btn-wide', { 'data-update-page': release.version }, function () {
    window.open(release.page, '_blank', 'noopener')
  })
  go.textContent = '打开发布页'
  box.appendChild(go)
  ui.content.appendChild(box)
}

/** @param {any} ui @param {any} s */
function renderVersions(ui, s) {
  if (s.releases === null) {
    if (s.loading) ui.content.appendChild(el('div', 'dp-empty', '正在问 ' + channelName() + ' 发布页…'))
    if (s.error !== null) {
      ui.content.appendChild(el('div', 'dp-empty', s.error))
      var retry = button('dp-btn dp-btn-wide', { 'data-dsh-retry': '' }, function () {
        load(ui)
        ui.renderContent()
      })
      retry.textContent = '再试一次'
      ui.content.appendChild(retry)
    }
    return
  }
  if (s.releases.length === 0) {
    ui.content.appendChild(el('div', 'dp-empty', '发布页上还没有能安装的版本'))
    ui.content.appendChild(pageButton('打开发布页', CHANNEL.releasesPage, true))
    return
  }
  // 刷新失败时保留上一次的列表，错误只占一行，不把已经看到的版本藏起来。
  if (s.error !== null) ui.content.appendChild(el('div', 'dp-req', '刷新失败：' + s.error + '，下面是上次的列表。'))
  var stable = []
  var previews = []
  for (var i = 0; i < s.releases.length; i += 1) {
    if (s.releases[i].prerelease) previews.push(s.releases[i])
    else stable.push(s.releases[i])
  }
  if (stable.length > 0) {
    ui.content.appendChild(el('div', 'dp-dim', '正式版'))
    for (var v = 0; v < stable.length; v += 1) ui.content.appendChild(versionRow(ui, s, stable[v]))
  }
  if (previews.length > 0) ui.content.appendChild(previewBox(ui, s, previews))
}

/** @param {any} ui @param {any} s @param {any[]} previews */
function previewBox(ui, s, previews) {
  var box = el('div', 'dp-rel')
  var row = button('dp-rel-head', { 'data-dsh-previews': '' }, function () {
    s.previews = !s.previews
    ui.renderContent()
  })
  row.appendChild(el('b', null, '测试版'))
  row.appendChild(el('small', null, previews.length + ' 个 · 不提醒，手动展开'))
  var tags = el('span', 'dp-rel-tags')
  tags.appendChild(tag('preview', s.previews ? '收起' : '展开'))
  row.appendChild(tags)
  box.appendChild(row)
  if (s.previews) {
    var body = el('div', 'dp-rel-body')
    body.appendChild(el('div', 'dp-dim', '测试版只在这里供手动选择：不会提醒，也不会自动安装。'))
    for (var i = 0; i < previews.length; i += 1) body.appendChild(versionRow(ui, s, previews[i]))
    box.appendChild(body)
  }
  return box
}

/** @param {any} ui @param {any} s @param {any} release */
function versionRow(ui, s, release) {
  var open = s.pick === release.version
  var current = isCurrent(ui, release.version)
  var box = el('div', 'dp-rel')
  box.setAttribute('data-dsh-release', release.version)
  var row = button('dp-rel-head', { 'data-dsh-open': release.version }, function () {
    s.pick = open ? null : release.version
    ui.renderContent()
  })
  row.appendChild(el('b', null, 'v' + release.version))
  if (release.date !== '') row.appendChild(el('small', null, release.date))
  var tags = el('span', 'dp-rel-tags')
  if (current) tags.appendChild(tag('current', '在用'))
  tags.appendChild(tag(release.prerelease ? 'preview' : 'stable', release.prerelease ? '测试版' : '正式版'))
  row.appendChild(tags)
  box.appendChild(row)
  if (open) box.appendChild(versionDetails(ui, s, release))
  return box
}

/** 现在跑的是不是这一版（版本号相同才算）。 */
function isCurrent(ui, version) {
  return ui.view.version ? compareVersions(version, ui.view.version) === 0 : false
}

/** 比现在在用的旧：装之前得先导出存档，旧版本也可能读不了新存档。 */
function isOlder(ui, version) {
  return ui.view.version ? compareVersions(version, ui.view.version) < 0 : false
}

/** @param {any} ui @param {any} s @param {any} release */
function versionDetails(ui, s, release) {
  var box = el('div', 'dp-rel-body')
  if (release.notes) {
    var notes = el('div', 'dp-update-notes', release.notes)
    notes.setAttribute('data-scroll-key', 'dsh-update-notes:' + release.version)
    box.appendChild(notes)
  } else {
    box.appendChild(el('div', 'dp-dim', '这个版本没有写更新说明。'))
  }
  if (isCurrent(ui, release.version)) {
    box.appendChild(el('div', 'dp-req dp-req-ok', '正在用这个版本'))
  } else {
    // 选中旧版本不等于要降级：只提醒、只给命令，更新页从不自己换版本。
    if (isOlder(ui, release.version)) {
      box.appendChild(el('div', 'dp-req', '这是旧版本 v' + release.version + '，低于当前 v' + ui.view.version + '。请先导出存档再装，旧版本可能读不了现在的存档。这里只提供安装指引，不会自动降级。'))
    }
    box.appendChild(installGuide(ui, s, release))
  }
  box.appendChild(pageButton('打开发布页', release.page, false, release.version))
  return box
}

/**
 * 按 npm 的实际结果给安装指引：确认有才给命令，404 说这一版没发到 npm，
 * 网络失败只说没问出来（可重试），不冒充「版本不存在」。
 * @param {any} ui @param {any} s @param {any} release
 */
function installGuide(ui, s, release) {
  var box = el('div', null)
  box.setAttribute('data-dsh-npm', release.version)
  var known = s.npm[release.version] ?? { state: 'checking' }
  // 第一次展开这一版才去问，整页列表不替用户批量查。
  if (s.npm[release.version] === undefined) checkNpm(ui, release.version)
  if (known.state === 'checking') {
    box.appendChild(el('div', 'dp-dim', '正在确认 npm 上有没有 v' + release.version + '…'))
  } else if (known.state === 'found') {
    box.appendChild(el('div', 'dp-dim', '在 DSH 里安装这个版本：'))
    box.appendChild(el('pre', 'dp-guide-code', 'dsh plugin --profile web add dsh-piggy@' + release.version))
    box.appendChild(el('div', 'dp-dim', '装完重启 DSH，再刷新页面。用别的 profile 时把 web 换成自己的。'))
  } else if (known.state === 'missing') {
    box.appendChild(el('div', 'dp-req', 'npm 上还没有 v' + release.version + '：这一版只在发布页上，没有对应的 npm 包。'))
    box.appendChild(el('div', 'dp-dim', '可以先从发布页下载这个版本的压缩包；等 npm 补上后再按版本安装。'))
    box.appendChild(npmAgain(ui, release.version))
  } else {
    box.appendChild(el('div', 'dp-req', '没能确认 npm 上有没有 v' + release.version + '（' + known.message + '）。'))
    box.appendChild(el('div', 'dp-dim', '这是没问到 npm，不代表这一版不存在；缓一下再查一次。'))
    box.appendChild(npmAgain(ui, release.version))
  }
  return box
}

/** 显式重查：只清掉这一版的结论，其它版本记住的答案不动。 */
function npmAgain(ui, version) {
  var go = button('dp-mini', { 'data-dsh-npm-retry': version }, function () {
    delete stateFor(ui).npm[version]
    ui.renderContent()
  })
  go.textContent = '再查一次 npm'
  return go
}

/**
 * 选中某一版时问一次 npm。200/404 都是答案，按版本记住（切来切去不重复请求）；
 * 网络错误也记住，但给重试按钮，重试时清掉再问。
 * @param {any} ui @param {string} version
 */
function checkNpm(ui, version) {
  var s = stateFor(ui)
  if (s.npm[version] !== undefined) return
  s.npm[version] = { state: 'checking' }
  fetchNpmVersion(version).then(function (answer) {
    s.npm[version] = { state: answer }
  }, function (error) {
    s.npm[version] = { state: 'error', message: error instanceof Error ? error.message : '没连上 npm' }
  }).then(function () {
    // 结果回来得晚：只有还停在同一页、同一份列表状态、还选中这一版时才重画，
    // 否则会把用户切过去的别的版本（或别的页）刷掉。
    if (state === s && ui.tab === 'update' && s.pick === version) ui.renderContent()
  })
}

/** @param {string} text @param {string} page @param {boolean} empty @param {string} [version] */
function pageButton(text, page, empty, version) {
  var go = button('dp-btn dp-btn-wide', empty ? { 'data-dsh-page': '' } : { 'data-update-page': version }, function () {
    window.open(page, '_blank', 'noopener')
  })
  go.textContent = text
  return go
}

/** @param {string} kind @param {string} text */
function tag(kind, text) {
  var node = el('span', 'dp-rel-tag', text)
  node.setAttribute('data-tag', kind)
  return node
}
