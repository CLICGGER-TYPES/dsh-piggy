// @ts-check
/**
 * 鱼咬钩后的搏斗（G 批次：三种玩法，核心在咬钩时随机定一种，写在 pending.fight）。
 *
 * - ring 圆盘：指针绕圈，转到绿区点一下，黄区算两下；空三圈鱼跑。
 * - bar 竖条拉锯：按住绿条上浮、松开下沉，让鱼待在绿条里，进度满了就钓上来。
 * - pull 拉力收线：按住收线、松开放线，指针稳在绿区才收线；进红区断线，太松太久鱼跑。
 *
 * 同一条鱼的进度按 fish.id 记在 `session` 里：面板重画也不会从头来。
 * @module dsh-piggy/client/tabs/fishing-fight
 */
import { button, el } from '../dom.js'

let frame = 0
let activeUi = null
let resolving = false
let session = null
const raf = fn => typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : 0
const caf = id => { if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id) }
let releaseHold = null

/** 停掉动画；`clear` 时连这条鱼的进度一起丢掉。 */
export function stopFight(clear = false) {
  if (frame) caf(frame)
  frame = 0
  activeUi = null
  if (releaseHold !== null) { releaseHold(); releaseHold = null }
  if (clear) session = null
}

export function fightActive(ui) { return activeUi === ui }

/** 换到别的阶段时清掉「正在结算」的标记。 */
export function resetFightResolve() { resolving = false }

/** 难度 1–100 → 各玩法的参数（越难越窄越快）。钓鱼 2.0 起用宿主算好的手感（已经乘过鱼竿）。 */
function difficultyOf(fish) {
  return Math.max(1, Math.min(100, Number(fish.feel?.difficulty ?? fish.difficulty) || 1))
}

/** 这条鱼的手感（鱼的游法 + 鱼竿），老宿主没有就是中性值。 */
function feelOf(fish) {
  const f = fish.feel || {}
  return { speed: f.speed || 1, burst: f.burst || 0, burstScale: f.burstScale || 1, drift: f.drift || 0, jitter: f.jitter || 0, zone: f.zone || 1, hold: f.hold || 1 }
}

/**
 * 鱼此刻的劲儿：平稳的匀速；冲刺的时不时猛冲；多变的忽快忽慢。返回速度倍数，s 里记着冲刺还剩多久。
 * @param {any} s @param {ReturnType<typeof feelOf>} feel @param {number} now @param {number} dt
 */
function surgeOf(s, feel, now, dt) {
  if ((s.burstLeft || 0) > 0) s.burstLeft -= dt
  else if (feel.burst > 0 && Math.random() < feel.burst * dt / 16) s.burstLeft = 260 + Math.random() * 240
  const wobble = 1 + feel.jitter * Math.sin(now / 380 + (s.phase || 0))
  return feel.speed * wobble * ((s.burstLeft || 0) > 0 ? feel.burstScale : 1)
}

export function renderFight(ui, fish) {
  const mode = fish.fight === 'bar' || fish.fight === 'pull' ? fish.fight : 'ring'
  if (session?.id !== fish.id || session.mode !== mode) session = { id: fish.id, mode }
  activeUi = ui
  const finish = success => {
    if (resolving) return
    resolving = true
    stopFight(true)
    ui.send('fishResolve', { success })
  }
  if (mode === 'bar') return renderBar(ui, fish, session, finish)
  if (mode === 'pull') return renderPull(ui, fish, session, finish)
  return renderRing(ui, fish, session, finish)
}

/** 面板关掉了就算输（三种玩法一样）。 */
function stillOpen(ui) { return activeUi === ui && ui.host.getAttribute('data-open') === 'true' }

/** 按住的玩法共用：指针按下 / 空格按下算按住，松开在 window 上收。 */
function holdControls(stage, s) {
  stage.addEventListener('pointerdown', function (event) { event?.preventDefault?.(); s.holding = true })
  stage.addEventListener('keydown', function (event) { if (event.code === 'Space' || event.key === ' ') { event.preventDefault?.(); s.holding = true } })
  stage.addEventListener('keyup', function (event) { if (event.code === 'Space' || event.key === ' ') s.holding = false })
  const up = function () { s.holding = false }
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pointerup', up)
    releaseHold = function () { if (typeof window.removeEventListener === 'function') window.removeEventListener('pointerup', up) }
  }
}

/** 搏斗要多久：C5 的 1.5 倍（用户 2026-10-10：等待短，难度放在搏斗上）。三种玩法都按它放慢收鱼。 */
const FIGHT_LENGTH = 1.5

// ---- 圆盘 ------------------------------------------------------------------

function ringRules(difficulty, feel) {
  return {
    zoneDegrees: Math.round((115 - difficulty * .38) * feel.zone),
    perfectDegrees: Math.round(16 - difficulty * .06),
    rotationsPerSecond: .28 + difficulty * .0018,
    hitsNeeded: Math.round((difficulty >= 80 ? 4 : difficulty >= 45 ? 3 : 2) * FIGHT_LENGTH),
  }
}

function newRingRound(s) {
  s.zoneStart = 105 + Math.random() * 135
  s.angle = 0
  s.completedCircles = 0
  s.startedAt = 0
  s.locked = false
  s.feedback = '看准绿色区域'
}

function renderRing(ui, fish, s, finish) {
  if (s.hits === undefined) {
    Object.assign(s, { hits: 0, misses: 0, phase: Math.random() * 6 }, ringRules(difficultyOf(fish), feelOf(fish)))
    newRingRound(s)
  }
  let lastPointerAt = -Infinity
  const wrap = button('dp-fish-qte', {
    'data-fish-qte': 'true', 'data-fish-fight': 'ring',
    'data-qte-difficulty': String(fish.difficulty),
    'data-qte-needed': String(s.hitsNeeded),
    'aria-label': '钓鱼技能检定，指针进入绿色区域时点击',
  }, function (event) {
    // 指针按下已经判过一次，随后的 click 不能再算；键盘触发的 click 照常判。
    if (event.detail > 0 && event.timeStamp - lastPointerAt < 700) return
    hit(event)
  })
  wrap.addEventListener('pointerdown', function (event) { lastPointerAt = event.timeStamp; hit(event) })
  const ring = el('div', 'dp-fish-qte-ring')
  const needle = el('i', 'dp-fish-qte-needle')
  const score = el('b', 'dp-fish-qte-score')
  const feedback = el('span', 'dp-fish-qte-feedback')
  ring.appendChild(needle)
  ring.appendChild(el('span', 'dp-fish-qte-core', fish.emoji))
  wrap.appendChild(el('div', 'dp-fish-qte-title', fish.emoji + '　咬紧了！'))
  wrap.appendChild(ring); wrap.appendChild(score); wrap.appendChild(feedback)
  wrap.appendChild(el('div', 'dp-fish-help', '指针进入绿色区域时点击或按空格 · 黄色为完美判定'))
  wrap.setAttribute('tabindex', '0')
  ui.content.appendChild(wrap)

  function paint() {
    const angle = s.angle % 360
    const perfectEnd = s.zoneStart + s.perfectDegrees
    const zoneEnd = s.zoneStart + s.zoneDegrees
    ring.style.background = `conic-gradient(from 0deg,#dce8e9 0deg ${s.zoneStart}deg,#ffd45d ${s.zoneStart}deg ${perfectEnd}deg,#6bd47b ${perfectEnd}deg ${zoneEnd}deg,#dce8e9 ${zoneEnd}deg 360deg)`
    needle.style.transform = `translateX(-50%) rotate(${angle}deg)`
    score.textContent = `技能检定 ${Math.min(s.hits, s.hitsNeeded)} / ${s.hitsNeeded}`
    feedback.textContent = `${s.feedback} · 机会 ${'♥'.repeat(3 - s.misses)}${'♡'.repeat(s.misses)}`
    wrap.setAttribute('data-qte-angle', angle.toFixed(1))
    wrap.setAttribute('data-qte-zone-start', s.zoneStart.toFixed(1))
    wrap.setAttribute('data-qte-zone-size', String(s.zoneDegrees))
    wrap.setAttribute('data-qte-misses', String(s.misses))
    wrap.setAttribute('data-qte-speed', String(s.rotationsPerSecond))
    wrap.setAttribute('data-qte-feedback', s.feedback)
  }

  function hit(event) {
    event?.preventDefault?.()
    if (s.locked || activeUi !== ui) return
    const offset = s.angle % 360 - s.zoneStart
    if (offset < 0 || offset > s.zoneDegrees) {
      s.feedback = offset < 0 ? '还没到时机，再等等' : '已经划过去了，等下一圈'
      paint()
      return
    }
    const perfect = offset <= s.perfectDegrees
    s.hits += perfect ? 2 : 1
    s.misses = 0
    s.feedback = perfect ? '完美！进度 +2' : '命中！'
    s.locked = true
    paint()
    if (s.hits >= s.hitsNeeded) return setTimeout(() => finish(true), 260)
    setTimeout(() => {
      if (session !== s || resolving) return
      newRingRound(s)
      paint()
    }, 380)
  }

  const feel = feelOf(fish)
  function tick(now) {
    if (!stillOpen(ui)) return finish(false)
    if (!s.startedAt) s.startedAt = now
    const dt = s.last ? Math.min(50, now - s.last) : 16
    s.last = now
    // 指针的速度跟着鱼的劲儿变：冲刺型的会突然快一截，多变型的忽快忽慢。
    if (!s.locked) s.angle += dt * s.rotationsPerSecond * .36 * surgeOf(s, feel, now, dt)
    const circles = Math.floor(s.angle / 360)
    if (!s.locked && circles > s.completedCircles) {
      s.misses += circles - s.completedCircles
      s.completedCircles = circles
      s.feedback = s.misses >= 3 ? '连续空了三圈，鱼跑掉了…' : `空了一圈，还剩 ${3 - s.misses} 圈机会`
      paint()
      if (s.misses >= 3) return finish(false)
    }
    paint()
    frame = raf(tick)
  }
  paint()
  frame = raf(tick)
}

// ---- 竖条拉锯 ----------------------------------------------------------------

const BAR_HEIGHT = 220

function renderBar(ui, fish, s, finish) {
  const d = difficultyOf(fish)
  const feel = feelOf(fish)
  if (s.progress === undefined) {
    Object.assign(s, {
      zoneH: Math.round(Math.max(46, 96 - d * .5) * feel.zone), zone: 0, vel: 0, phase: Math.random() * 6,
      fishY: BAR_HEIGHT * .3, target: BAR_HEIGHT * .3, wait: 0, progress: 30, holding: false, last: 0,
    })
  }
  const stage = button('dp-fish-stage', { 'data-fish-fight': 'bar', 'data-fish-bar': 'true', 'aria-label': '按住让绿条上浮，让鱼待在绿条里' }, function () {})
  stage.setAttribute('tabindex', '0')
  const bar = el('div', 'dp-fish-bar')
  const track = el('div', 'dp-fish-track')
  const zone = el('i', 'dp-fish-zone')
  const swimmer = el('span', 'dp-fish-swimmer', fish.emoji)
  const meter = el('div', 'dp-fish-vmeter')
  const fill = el('i')
  track.appendChild(zone); track.appendChild(swimmer); meter.appendChild(fill)
  bar.appendChild(track); bar.appendChild(meter)
  stage.appendChild(el('div', 'dp-fish-qte-title', fish.emoji + '　咬紧了！'))
  stage.appendChild(bar)
  const hint = el('div', 'dp-fish-help', '按住（或空格）绿条上浮，松开下沉 · 让鱼待在绿条里')
  stage.appendChild(hint)
  ui.content.appendChild(stage)
  holdControls(stage, s)

  function moveFish(dt, now) {
    s.wait -= dt
    if (s.wait <= 0) {
      const calm = fish.behavior === 'smooth'
      // 上浮 / 下沉的鱼一直往一个方向拽（drift），平稳的小范围游，其余按难度大范围乱窜。
      const target = s.fishY + (Math.random() - .5) * (calm ? 90 : 60 + d * 1.6) * feel.speed + feel.drift * 1.2
      s.target = Math.max(8, Math.min(BAR_HEIGHT - 8, target))
      s.wait = (calm ? 900 : Math.max(250, 900 - d * 6)) / feel.speed
    }
    s.fishY += (s.target - s.fishY) * Math.min(1, dt * (.0018 + d * .00005) * surgeOf(s, feel, now, dt))
  }

  function tick(now) {
    if (!stillOpen(ui)) return finish(false)
    const dt = s.last ? Math.min(50, now - s.last) : 16
    s.last = now
    s.vel = Math.max(-.5, Math.min(.5, s.vel + (s.holding ? .0016 : -.0013) * dt))
    s.zone += s.vel * dt
    if (s.zone < 0) { s.zone = 0; s.vel = s.vel < 0 ? -s.vel * .3 : s.vel }
    if (s.zone > BAR_HEIGHT - s.zoneH) { s.zone = BAR_HEIGHT - s.zoneH; s.vel = Math.min(0, s.vel) }
    moveFish(dt, now)
    const inside = s.fishY >= s.zone && s.fishY <= s.zone + s.zoneH
    s.progress = Math.max(0, Math.min(100, s.progress + (inside ? .028 / FIGHT_LENGTH : -.022 - d * .0001) * dt))
    zone.style.bottom = s.zone + 'px'
    zone.style.height = s.zoneH + 'px'
    swimmer.style.bottom = s.fishY + 'px'
    fill.style.height = s.progress + '%'
    stage.setAttribute('data-inside', inside ? 'true' : 'false')
    stage.setAttribute('data-progress', s.progress.toFixed(0))
    if (s.progress >= 100) return finish(true)
    if (s.progress <= 0) return finish(false)
    frame = raf(tick)
  }
  frame = raf(tick)
}

// ---- 拉力收线 ----------------------------------------------------------------

function renderPull(ui, fish, s, finish) {
  const d = difficultyOf(fish)
  const feel = feelOf(fish)
  // 好竿更耐拉：断线的红区往后挪（最多到 95）。
  const snap = Math.min(95, 85 + (feel.hold - 1) * 50)
  if (s.distance === undefined) {
    Object.assign(s, { tension: 40, distance: 100, loose: 0, surge: 0, surgeCd: 1500, holding: false, last: 0 })
  }
  const stage = button('dp-fish-stage', { 'data-fish-fight': 'pull', 'data-fish-pull': 'true', 'aria-label': '按住收线，松开放线，指针别进红区' }, function () {})
  stage.setAttribute('tabindex', '0')
  const line = el('div', 'dp-fish-line')
  const rod = el('span', 'dp-fish-rod', '🎣')
  line.appendChild(rod)
  line.appendChild(el('span', 'dp-fish-string', '〰〰〰'))
  line.appendChild(el('span', 'dp-fish-rod', fish.emoji))
  const gauge = el('div', 'dp-fish-gauge')
  // 红区（断线）从鱼竿的耐拉值开始，好竿红区更靠后。
  gauge.style.background = `linear-gradient(90deg,#dce8e9 0 30%,#6bd47b 30% ${snap - 13}%,#ffd45d ${snap - 13}% ${snap}%,#e05a5a ${snap}%)`
  const pin = el('b')
  gauge.appendChild(pin)
  const state = el('div', 'dp-fish-pull-state')
  const meter = el('div', 'dp-fish-hmeter')
  const fill = el('i')
  meter.appendChild(fill)
  stage.appendChild(el('div', 'dp-fish-qte-title', fish.emoji + '　咬紧了！'))
  stage.appendChild(line); stage.appendChild(gauge); stage.appendChild(state); stage.appendChild(meter)
  stage.appendChild(el('div', 'dp-fish-help', '按住（或空格）收线，松开放线 · 鱼发力时松一松'))
  ui.content.appendChild(stage)
  holdControls(stage, s)

  function tick(now) {
    if (!stillOpen(ui)) return finish(false)
    const dt = s.last ? Math.min(50, now - s.last) : 16
    s.last = now
    s.surgeCd -= dt
    if (s.surgeCd <= 0) {
      // 鱼发力：冲刺 / 多变型更猛更勤，平稳型很少发力。
      s.surge = (10 + d * .28) * feel.speed * (feel.burst > 0.015 ? 1.25 : 1)
      s.surgeCd = (Math.max(700, 2600 - d * 16) + Math.random() * 900) / (feel.burst > 0 ? 1 + feel.burst * 20 : 0.8)
    }
    s.tension = Math.max(0, Math.min(100, s.tension + ((s.holding ? .055 : -.05) + s.surge * .004) * dt))
    s.surge = Math.max(0, s.surge - dt * .02)
    const green = s.tension >= 30 && s.tension < snap
    const sweet = s.tension >= snap - 13 && s.tension < snap
    if (green) { s.distance -= (sweet ? .022 : .012) / FIGHT_LENGTH * dt * (1 - d * .004); s.loose = Math.max(0, s.loose - dt) }
    if (s.tension < 30) s.loose += dt
    pin.style.left = s.tension + '%'
    rod.style.transform = s.holding ? 'rotate(-12deg)' : 'none'
    fill.style.width = (100 - Math.max(0, s.distance)) + '%'
    state.textContent = (s.surge > 2 ? fish.emoji + ' 发力了！' : s.tension < 30 ? '太松了！' : s.tension >= snap ? '要断了！' : sweet ? '稳！收得快' : '收线中')
      + ' · 离岸 ' + Math.max(0, s.distance).toFixed(0) + ' 米'
    stage.setAttribute('data-tension', s.tension.toFixed(0))
    if (s.tension >= 100) return finish(false)
    if (s.loose > 2600) return finish(false)
    if (s.distance <= 0) return finish(true)
    frame = raf(tick)
  }
  frame = raf(tick)
}
