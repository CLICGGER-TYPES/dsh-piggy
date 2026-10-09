// @ts-check
/**
 * 调试页签（仅开发者模式可见）。
 *
 * G 批次：按模块分页（状态 / 成长与生病 / 形态与皮肤 / 番茄钟 / 钓鱼 / 签到与礼包 / 更新与扩展 /
 * 台词 / 时间与面板 / 数值），顶上一排页签 + 左右箭头，也能左右滑；每个按钮下面一行小字写清
 * 「点了会发生什么」。所有页都画出来、只显示当前这页，按钮的 data-dev 键和以前一样。
 * @module dsh-piggy/client/tabs/dev
 */

import { button, el, sideScroller } from '../dom.js'
import { desktopShell } from '../desktop-shell.js'
import { num } from '../values.js'
import { FISH } from '../../../packages/pet-core/src/data/fish.js'
import { SKINS } from '../../../packages/pet-core/src/data/skins.js'
import { LINES } from '../../../packages/pet-core/src/data/lines.js'
import { JOBS } from '../../../packages/pet-core/src/data/jobs.js'
import { INTERESTS } from '../../../packages/pet-core/src/data/interests.js'
import { FEEDBACK_ART_TABLES, UNUSED_FEEDBACK_ART } from '../feedback-art.js'
import { ILLNESS_CHAINS } from '../../../packages/pet-core/src/data/illness.js'
import { IDLE_ACTIONS } from '../life.js'
import { renderEconomy } from './dev-economy.js'

/** 台词场景的中文名（调试页按钮上用）。 */
var SCENE_NAMES = {
  eat: '吃饭', full: '吃饱', overfull: '撑着', bathe: '洗澡', play: '玩耍', pet: '摸摸', hungry: '饿了',
  dirty: '脏了', lonely: '孤单', idle: '闲聊', workDone: '打工回来', tired: '累了', study: '上学', graduate: '毕业',
  tripBack: '旅行回来', sick: '生病', wrongMedicine: '吃错药', cured: '治好', levelup: '升级', growUp: '长大',
  coronation: '加冕', contract: '签约', enter: '进门', death: '去世', revive: '复活', signIn: '签到', gift: '礼包',
  pomodoroStart: '番茄开始', pomodoroDone: '番茄完成', pomodoroAbandon: '番茄放弃',
}

/** 「立绘」页的场景名。 */
var ART_SCENE_NAMES = {
  box: '纸盒', 'dead-day': '去世当天', grave: '墓碑（满一天）',
  feed: '喂食', bathe: '洗澡', play: '玩耍', pet: '摸头', cure: '治病', levelup: '升级',
  sick: '生病', hungry: '饿', sleepy: '困', lonely: '孤单', dirty: '脏', happy: '开心',
  roll: '打滚', butterfly: '追蝴蝶', scratch: '挠痒', stretch: '伸懒腰', look: '张望', bubbles: '吹泡泡', walk: '散步', nap: '打盹',
  other: '其他兴趣班',
}
var ART_KIND_NAMES = { stage: '', birthday: '生日当天点蛋糕', illness: '生病·', reaction: '互动·', mood: '心情·', work: '打工·', study: '上学', interest: '兴趣班·', fishing: '钓鱼', trip: '旅行', idle: '小动作·' }

/** 每张反馈图用在哪些场景：{ 图名: ['心情·开心', '升级', …] }，按表里出现的先后排。 */
export function feedbackArtUses() {
  var jobNames = {}
  JOBS.forEach(function (job) { jobNames[job.key] = job.label })
  INTERESTS.forEach(function (lesson) { jobNames['interest:' + lesson.key] = lesson.label })
  ILLNESS_CHAINS.forEach(function (chain) {
    chain.stages.forEach(function (entry, at) { jobNames['illness:' + chain.key + ':' + (at + 1)] = chain.name + '·' + entry.name })
  })
  var uses = {}
  var add = function (name, where) { (uses[name] = uses[name] || []).push(where) }
  Object.keys(FEEDBACK_ART_TABLES).forEach(function (kind) {
    var table = FEEDBACK_ART_TABLES[kind]
    var prefix = ART_KIND_NAMES[kind]
    if (Array.isArray(table)) { table.forEach(function (name) { add(name, prefix) }); return }
    Object.keys(table).forEach(function (key) {
      var label = kind === 'work' ? jobNames[key] ?? key
        : kind === 'illness' ? jobNames['illness:' + key] ?? key
        : kind === 'interest' ? jobNames['interest:' + key] ?? ART_SCENE_NAMES[key] ?? key
          : ART_SCENE_NAMES[key] ?? key
      ;[].concat(table[key]).forEach(function (name) { add(name, prefix + label) })
    })
  })
  add('recruit', '盲盒寻访页')
  UNUSED_FEEDBACK_ART.forEach(function (name) { add(name, '暂不使用（待定）') })
  return uses
}

/** 当前在哪一页（只在内存里，刷新回到第一页）。 */
var currentPage = 'status'

export function renderDevTab(ui) {
  // 关掉调试模式就靠这个按钮（C1：没有快捷键，也不写 localStorage）。
  var topBar = el('div', 'dp-dev-row')
  var off = button('dp-mini dp-dev-btn', { 'data-dev': 'devOff' }, function () { ui.devOff() })
  off.textContent = '🔧 关闭调试'
  topBar.appendChild(off)
  ui.content.appendChild(topBar)
  ui.content.appendChild(el('div', 'dp-dev-note', '🔧 开发者模式 · 构建 v' + (ui.view.version === '' ? '未知' : ui.view.version)))
  if (ui.view.pig !== null && ui.view.pig.ageForced) {
    ui.content.appendChild(el('div', 'dp-dev-note',
      '⚠️ 年龄是调试改的（HUD 上有 🔧）—— 按「⏪ 天数归零」才会重新按真实时间算'))
  }

  var patch = function (body) { ui.send('dev', { patch: body }) }
  var pages = []
  /** 新开一页，返回往这页里加分组的函数。 */
  function page(key, label) {
    var body = el('div', 'dp-dev-page')
    body.setAttribute('data-dev-page-body', key)
    pages.push({ key: key, label: label, body: body })
    return function group(title, entries, note) {
      var head = el('div', 'dp-title')
      head.appendChild(el('b', null, title))
      body.appendChild(head)
      if (note !== undefined && note !== '') body.appendChild(el('div', 'dp-dev-note', note))
      var wrap = el('div', 'dp-dev-list')
      for (var i = 0; i < entries.length; i += 1) {
        (function (entry) {
          var item = el('div', 'dp-dev-item')
          var btn = button('dp-mini dp-dev-btn', { 'data-dev': entry.key }, function () { entry.run() })
          btn.textContent = entry.label
          if (entry.off === true) btn.disabled = true
          item.appendChild(btn)
          if (entry.desc) item.appendChild(el('small', 'dp-dev-desc', entry.desc))
          wrap.appendChild(item)
        })(entries[i])
      }
      body.appendChild(wrap)
    }
  }

  // ---- 形态与皮肤（先构建：纸盒也要看得到形态这一排，置灰 + 原因） ----
  var boxed = ui.view.hatched !== true || ui.view.pig === null
  var dead = ui.view.dead === true
  var why = boxed ? '先孵化' : (dead ? '先复活' : '')
  var forms = ui.view.forms === null ? [] : ui.view.forms.forms
  var looks = page('looks', '形态皮肤')
  var formEntries = forms.map(function (form) {
    return {
      key: 'form:' + form.key, label: form.emoji + ' ' + form.label, off: boxed || dead,
      desc: '直接变成' + form.label + '，不看条件；等级不够会顺手补到这一阶段',
      run: function () {
        var body = { form: form.key }
        var level = ui.view.pig === null ? 0 : ui.view.pig.level.level
        if (level < form.fromLevel) body.level = form.fromLevel
        patch(body)
      },
    }
  })
  formEntries.push({ key: 'form:none', label: '🐖 恢复普通', desc: '去掉形态，回到普通小猪', run: function () { patch({ form: null }) } })
  looks('形态', formEntries, why)

  var p = ui.view.pig
  if (p === null) {
    currentPage = 'looks'
    renderPages(ui, pages)
    ui.content.appendChild(el('div', 'dp-empty', '还没有猪。先「拆开纸盒」再调。'))
    return
  }

  var skinRows = ui.view.skins?.entries?.length > 0 ? ui.view.skins.entries : SKINS
  looks('皮肤', skinRows.map(function (skin) {
    return { key: 'skin:' + skin.key, label: skin.emoji + ' ' + skin.label, desc: skin.unlockJob ? '职业皮肤：不用打工直接试穿' : '换上这款皮肤',
      run: function () {
        if (skin.unlockJob) patch({ skin: skin.key })
        else ui.send('skin', { skin: skin.key })
      } }
  }), '形态显示优先于皮肤；恢复普通形态即可看到皮肤。')
  looks('道具', forms.filter(function (form) { return form.item !== '' }).map(function (form) {
    return {
      key: 'item:' + form.item, label: form.emoji + ' 给' + form.label + '道具', desc: '背包里加一个晋升道具，用来测正常的晋升流程',
      run: function () { patch({ inventory: { [form.item]: num(ui.view.inventory[form.item], 0) + 1 } }) },
    }
  }))

  // ---- 状态 ----
  var status = page('status', '状态')
  status('状态', [
    { key: 'full', label: '😊 满状态', desc: '饱食、心情、清洁 100，健康满格', run: function () { patch({ satiety: 100, happiness: 100, cleanliness: 100, health: 5 }) } },
    { key: 'hungry', label: '🍎 饿', desc: '饱食 10：看饿了的台词和生病风险', run: function () { patch({ satiety: 10 }) } },
    { key: 'dirty', label: '🫧 脏', desc: '清洁 10', run: function () { patch({ cleanliness: 10 }) } },
    { key: 'lonely', label: '🥺 孤单', desc: '心情 10', run: function () { patch({ happiness: 10 }) } },
    { key: 'sleepy', label: '💤 困', desc: '三项都 90，测试困了的闲聊', run: function () { patch({ satiety: 90, happiness: 90, cleanliness: 90 }) } },
  ])
  status('资源', [
    { key: 'coin100', label: '🪙 +100', desc: '金币加 100', run: function () { patch({ coins: p.coins + 100 }) } },
    { key: 'coin999', label: '🪙 9999', desc: '金币设成 9999', run: function () { patch({ coins: 9999 }) } },
    { key: 'traits', label: '🧠+5 ✨+5 💪+5', desc: '智力、魅力、武力各 +5', run: function () { patch({ traits: { intel: 5, charm: 5, strong: 5 } }) } },
    { key: 'all', label: '🎁 一键拿齐', desc: '商店里每样东西都给几个', run: function () { ui.send('giveAll') } },
  ])
  status('生死', [
    { key: 'kill', label: '💀 弄死', desc: '当天保留遗体，次日出现墓碑与灵魂；测复活和领养', run: function () { patch({ dead: true }) } },
    { key: 'revive', label: '✨ 复活', desc: '不用还魂丹直接复活', run: function () { patch({ dead: false, health: 5 }) } },
    { key: 'adopt', label: '📦 领养', desc: '领养一只新猪（旧猪的故事留在记忆里）', run: function () { ui.send('adopt') } },
    { key: 'reset', label: '🔄 重置', desc: '清空存档，从纸盒重新开始', run: function () { ui.send('reset') } },
  ])

  // ---- 成长与生病 ----
  var growth = page('growth', '成长生病')
  growth('等级', [
    { key: 'box', label: '📦 纸盒', desc: '回到没拆的纸盒', run: function () { patch({ hatched: false }) } },
    { key: 'lv1', label: '幼年 Lv1', desc: '拆盒并设成 1 级', run: function () { patch({ hatched: true, level: 1 }) } },
    { key: 'lv10', label: '青年 Lv10', desc: '设成 10 级（青年体型）', run: function () { patch({ level: 10 }) } },
    { key: 'lv40', label: '成年 Lv40', desc: '设成 40 级（成年体型）', run: function () { patch({ level: 40 }) } },
    { key: 'lv60', label: '满级 Lv60', desc: '设成满级', run: function () { patch({ level: 60 }) } },
    { key: 'real', label: '⏪ 天数归零', desc: '取消调试改过的年龄，按真实时间重新算', run: function () { ui.send('ageFromNow') } },
  ])
  growth('体重', [
    { key: 'weight:normal', label: '⚖️ 正常', desc: '体重设到理想体重', run: function () { patch({ weightClass: 'normal' }) } },
    { key: 'weight:round', label: '🐷 圆润', desc: '体重设到圆润档（换圆润立绘）', run: function () { patch({ weightClass: 'round' }) } },
    { key: 'weight:fat', label: '🐖 胖胖', desc: '体重设到胖胖档（换胖胖动作立绘）', run: function () { patch({ weightClass: 'fat' }) } },
  ])
  growth('生病', [
    { key: 'cold1', label: '🤧 感冒', desc: '感冒第 1 期，健康 4', run: function () { patch({ illness: { chain: 0, stage: 1 }, health: 4 }) } },
    { key: 'fever', label: '🤒 发烧', desc: '感冒第 2 期（发烧图）', run: function () { patch({ illness: { chain: 0, stage: 2 }, health: 3 }) } },
    { key: 'cough1', label: '😷 咳嗽', desc: '咳嗽第 1 期', run: function () { patch({ illness: { chain: 1, stage: 1 }, health: 4 }) } },
    { key: 'belly1', label: '🤢 肚子胀', desc: '肠胃第 1 期（胃胀气那条）', run: function () { patch({ illness: { chain: 2, stage: 1 }, health: 4 }) } },
    { key: 'dizzy1', label: '😵 头晕', desc: '头晕第 1 期（连续出门太多那条）', run: function () { patch({ illness: { chain: 3, stage: 1 }, health: 4 }) } },
    { key: 'skin1', label: '🩹 瘙痒', desc: '皮肤第 1 期（太脏那条）', run: function () { patch({ illness: { chain: 4, stage: 1 }, health: 4 }) } },
    { key: 'cold4', label: '☠️ 肺炎', desc: '感冒最后一期，健康 1：再拖就会死', run: function () { patch({ illness: { chain: 0, stage: 4 }, health: 1 }) } },
    { key: 'cure', label: '💚 治好', desc: '直接病好，健康满格', run: function () { patch({ illness: null, health: 5 }) } },
  ])

  // ---- 番茄钟 ----
  page('pomodoro', '番茄钟')('番茄钟', [
    { key: 'pomoDone', label: '🍅 完成当前', desc: '正在专注的这一个立刻到点，照常发奖', run: function () { patch({ pomodoro: { finish: true } }) } },
  ])

  // ---- 钓鱼 ----
  var fishEntries = FISH.map(function (fish) {
    return { key: 'fish:' + fish.key, label: fish.emoji + ' ' + fish.label, desc: '鱼篓里直接放一条', run: function () { ui.send('fishGive', { fish: fish.key }) } }
  })
  fishEntries.push({ key: 'fish:skip', label: '❗ 跳过等待', desc: '抛竿后不用等，马上咬钩', run: function () { ui.send('fishSkip') } })
  page('fishing', '钓鱼')('钓鱼', fishEntries)

  // ---- 签到与礼包 ----
  // 简化的测试视图可能没有 daily / extensions：按默认值画，不报错。
  var dailyView = ui.view.daily ?? { cycle: 7, signInDay: 1, canSignIn: true, signInTotal: 0, unclaimed: 0 }
  var extensions = ui.view.extensions ?? []
  var daily = page('daily', '签到礼包')
  var days = []
  for (var d = 1; d <= dailyView.cycle; d += 1) {
    (function (day) {
      days.push({ key: 'signin:' + day, label: '📅 第 ' + day + ' 天', desc: '下一次签到领第 ' + day + ' 天，今天可以再签', run: function () { patch({ signInDay: day }) } })
    })(d)
  }
  daily('签到', days, '现在：第 ' + dailyView.signInDay + '/' + dailyView.cycle + ' 天' + (dailyView.canSignIn ? ' · 今天还没签' : ' · 今天已签'))
  daily('在线礼包', [
    { key: 'gifts:1', label: '🎁 攒 1 个', desc: '猪头上出现礼包按钮', run: function () { patch({ gifts: 1 }) } },
    { key: 'gifts:3', label: '🎁 攒满 3 个', desc: '礼包上限是 3 个', run: function () { patch({ gifts: 3 }) } },
    { key: 'gifts:0', label: '🚫 清空', desc: '没有待领的礼包', run: function () { patch({ gifts: 0 }) } },
  ])

  // ---- 更新与扩展 ----
  var system = page('system', '更新扩展')
  var notice = ui.updateNotice
  system('更新', [
    { key: 'update:fake', label: '🔴 假装有新版', desc: '让设置图标和设置页冒红点（不会真的下载）', off: !notice || typeof notice.simulate !== 'function',
      run: function () { notice.simulate('9.9.9'); ui.renderContent() } },
    { key: 'update:read', label: '✅ 标为已读', desc: '红点消失（和打开更新页一样）', off: !notice,
      run: function () { notice.markRead(); ui.renderContent() } },
  ])
  system('扩展', extensions.map(function (extension) {
    return { key: 'ext:' + extension.key, label: extension.emoji + ' ' + (extension.on ? '关掉' : '打开') + extension.label,
      desc: extension.on ? '和扩展 App 里关掉一样（进行中的会收尾）' : '重新打开，数据原样回来',
      run: function () { ui.send('setExtension', { key: extension.key, on: !extension.on }) } }
  }))

  // ---- 台词 ----
  page('lines', '台词')('让猪说一句', Object.keys(LINES).map(function (scene) {
    return { key: 'say:' + scene, label: '💬 ' + (SCENE_NAMES[scene] ?? scene), desc: '随机说「' + scene + '」场景里的一句（免打扰时不说）',
      run: function () { patch({ say: scene }) } }
  }))

  // ---- 时间与面板 ----
  var time = page('time', '时间面板')
  time('时间', [
    { key: 'real', label: '×1 真实', desc: '时间按真实速度走', run: function () { ui.send('timeScale', { scale: 1 }) } },
    { key: 'fast12', label: '×12', desc: '1 分钟 = 猪的 12 分钟', run: function () { ui.send('timeScale', { scale: 12 }) } },
    { key: 'fast30', label: '×30', desc: '1 分钟 = 猪的半小时', run: function () { ui.send('timeScale', { scale: 30 }) } },
    { key: 'fast60', label: '×60', desc: '1 分钟 = 猪的 1 小时', run: function () { ui.send('timeScale', { scale: 60 }) } },
  ])
  time('面板', [
    { key: 'open', label: '展开/收起', desc: '切换面板开关（测开关动画）', run: function () { ui.setOpen(ui.host.getAttribute('data-open') !== 'true') } },
    { key: 'away1', label: '⏩ +1 小时', desc: '时间直接过去 1 小时（结算数值、成长、打工）', run: function () { patch({ __advanceMs: 3600000 }) } },
    { key: 'away24', label: '⏩ +1 天', desc: '时间直接过去 1 天（换天、签到、日记）', run: function () { patch({ __advanceMs: 86400000 }) } },
  ])
  time('猪自己找事做', [
    { key: 'idle', label: '🐷 小动作', desc: '马上做一个小动作（打滚、打盹、追蝴蝶……）', off: !ui.life, run: function () { ui.setOpen(false); ui.life.idleNow() } },
    { key: 'walk', label: '🚶 散步一次', desc: '马上沿屏幕底边走一趟（只有桌面版）', off: !ui.life || typeof desktopShell()?.moveBy !== 'function', run: function () { ui.setOpen(false); ui.life.walkNow() } },
    { key: 'timeTalk', label: '🕐 按时间说', desc: '问一次「现在有没有按时间该说的话」（一天一次的已经说过就不说）', run: function () { ui.send('chat', { reason: 'time' }) } },
  ])

  // ---- 立绘：逐张看反馈图、指定小动作 ----
  var art = page('art', '立绘')
  var uses = feedbackArtUses()
  var artEntries = [{ key: 'art:auto', label: '🔄 恢复自动', desc: '按状态自动选图（同一状态几张图按小时轮换）', run: function () { ui.previewArt(null) } }]
  Object.keys(uses).sort().forEach(function (name) {
    artEntries.push({ key: 'art:' + name, label: '🖼️ ' + name, desc: uses[name].join('、'), run: function () { ui.previewArt(name) } })
  })
  art('反馈图', artEntries, '点一张，猪就一直显示这张，直到「恢复自动」；只影响画面，不改存档。专属形态和导入皮肤平时不用这些图。')
  art('生日', [{ key: 'birthday', label: '🎂 过生日', desc: '猪头顶马上冒蛋糕（签到、礼包没领时排在它们后面），点蛋糕看生日图', off: typeof ui.birthdayNow !== 'function',
    run: function () { ui.previewArt(null); ui.birthdayNow() } }])
  art('小动作', IDLE_ACTIONS.map(function (action) {
    return { key: 'idle:' + action.key, label: '🐷 ' + (ART_SCENE_NAMES[action.key] ?? action.key), off: typeof ui.idleNow !== 'function',
      desc: action.key === 'nap' ? '打盹：换成睡姿立绘，头顶冒 Zzz' : '马上做这个小动作（会先恢复自动选图）',
      run: function () { ui.previewArt(null); ui.idleNow(action.key) } }
  }), '面板开着也能看：桌面版的猪在自己的窗口里。')

  // ---- 经济：钱从哪来、花到哪去（docs/design/economy.md） ----
  var money = el('div', 'dp-dev-page')
  money.setAttribute('data-dev-page-body', 'economy')
  pages.push({ key: 'economy', label: '经济', body: money })
  renderEconomy(ui, money)

  // ---- 数值（只看不改） ----
  var values = el('div', 'dp-dev-page')
  values.setAttribute('data-dev-page-body', 'values')
  pages.push({ key: 'values', label: '数值', body: values })
  var rows = [
    ['阶段', p.stage?.label ?? '—'], ['等级', p.level ? 'Lv.' + p.level.level + '（还差 ' + Math.ceil(p.level.toNext) + '）' : '—'],
    ['饱食', p.satiety], ['心情', p.happiness], ['清洁', p.cleanliness], ['健康', p.health + '/' + (ui.view.maxHealth ?? 5)],
    ['体重', p.weight + (p.bodyWeight ? '（' + p.bodyWeight.weightG + ' g · ' + p.bodyWeight.label + '）' : '')],
    ['金币', p.coins], ['智力 / 魅力 / 武力', p.traits ? p.traits.intel + ' / ' + p.traits.charm + ' / ' + p.traits.strong : '—'],
    ['生病', p.illness ? p.illness.name : '—'], ['在外面', ui.view.activity ? ui.view.activity.label : '—'],
    ['签到', '第 ' + dailyView.signInDay + ' 天 · 累计 ' + dailyView.signInTotal + ' 次'], ['待领礼包', dailyView.unclaimed],
    ['扩展', extensions.map(function (e) { return e.label + (e.on ? '开' : '关') }).join(' · ')],
    ['免打扰', ui.view.dialogue?.quiet ? '开' : '关'], ['时间倍率', '×' + (ui.view.timeScale ?? 1)],
  ]
  for (var r = 0; r < rows.length; r += 1) {
    var row = el('div', 'dp-row')
    row.appendChild(el('span', null, rows[r][0]))
    row.appendChild(el('b', null, String(rows[r][1])))
    values.appendChild(row)
  }

  renderPages(ui, pages)
}

/** 页签 + 左右箭头 + 左右滑，只显示当前这一页。 */
function renderPages(ui, pages) {
  if (!pages.some(function (entry) { return entry.key === currentPage })) currentPage = pages[0].key
  var index = pages.findIndex(function (entry) { return entry.key === currentPage })
  var go = function (to) { currentPage = pages[(to + pages.length) % pages.length].key; ui.renderContent() }
  var nav = el('div', 'dp-dev-nav')
  var prev = button('dp-mini dp-mini-plain', { 'data-dev-prev': 'true' }, function () { go(index - 1) })
  prev.textContent = '‹'
  nav.appendChild(prev)
  var tabs = el('div', 'dp-dev-tabs')
  for (var i = 0; i < pages.length; i += 1) {
    (function (entry, at) {
      var tab = button('dp-dev-tab', { 'data-dev-page': entry.key, 'aria-pressed': String(at === index) }, function () { go(at) })
      tab.textContent = entry.label
      tabs.appendChild(tab)
    })(pages[i], i)
  }
  nav.appendChild(tabs)
  var next = button('dp-mini dp-mini-plain', { 'data-dev-next': 'true' }, function () { go(index + 1) })
  next.textContent = '›'
  nav.appendChild(next)
  ui.content.appendChild(nav)
  sideScroller(tabs, tabs.children ? tabs.children[index] : null)
  var start = null
  for (var k = 0; k < pages.length; k += 1) {
    var body = pages[k].body
    body.hidden = k !== index
    if (typeof body.addEventListener === 'function') {
      body.addEventListener('pointerdown', function (event) { start = event.clientX })
      body.addEventListener('pointerup', function (event) {
        if (start === null || typeof event.clientX !== 'number') return
        var dx = event.clientX - start
        start = null
        if (Math.abs(dx) > 50) go(dx < 0 ? index + 1 : index - 1)
      })
    }
    ui.content.appendChild(body)
  }
}
