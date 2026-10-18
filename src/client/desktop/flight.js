// @ts-check
/**
 * A2 抛掷的纯物理：脚底中心的位置、重力、屏幕边反弹、落地和摔晕判定。
 *
 * 不含 DOM、不含窗口、不含弹簧手感；60/120/144Hz 都按固定 1/120 秒子步推进，
 * 页面只负责把算出来的位置发给外壳。这样这段逻辑可以在 Node 里直接测。
 * @module dsh-piggy/client/desktop/flight
 */
import { FEEL } from '../feel/config.js'

const STEP = 1 / 120

/** 外壳有没有抛掷能力（旧外壳没有 flyMove）。 */
export function supportsFlight(shell) {
  return shell !== null && typeof shell === 'object' && typeof shell.flyMove === 'function'
}

/** @param {number} value @param {number} min @param {number} max */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * @param {{
 *   x:number, y:number, vx:number, vy:number,
 *   area:{x:number,y:number,width:number,height:number},
 *   pig:{width:number,height:number}, artMargin?:number,
 * }} options
 */
export function createFlight(options) {
  const area = options.area
  const pig = options.pig
  const artMargin = Number.isFinite(options.artMargin) ? options.artMargin : 0
  const reach = Math.min(area.width / 2, pig.width / 2 + artMargin)
  const left = area.x + reach
  const right = area.x + area.width - reach
  const floor = area.y + area.height
  const ceiling = area.y + pig.height + 8

  const speed = Math.hypot(options.vx, options.vy)
  const scale = speed > FEEL.throwMax ? FEEL.throwMax / speed : 1
  let x = clamp(options.x, Math.min(left, right), Math.max(left, right))
  let y = Math.min(options.y, floor)
  let vx = options.vx * scale
  let vy = options.vy * scale
  // 站在地上平着甩：只靠重力会让猪立刻碰地、横向速度当场归零，看起来像没扔出去。
  // 给一条向上的初速，让它先离地再落下；向下甩（vy 明显为负）保持原样。
  if (y >= floor - 2 && speed >= FEEL.throwMin && vy > -60 && Math.abs(vy) < Math.abs(vx) * 0.8) {
    vy = -Math.max(260, Math.min(900, speed * 0.3))
  }
  let elapsed = 0
  let accumulator = 0
  let done = false
  let landed = false

  /** @type {{type:string, speed?:number, side?:string}[]} */
  let events = []

  function emit(event) {
    events.push(event)
  }

  function step(h) {
    // 空气阻力：只削速度，不改手感。
    if (FEEL.airDrag > 0) {
      const drag = Math.exp(-FEEL.airDrag * h)
      vx *= drag
      vy *= drag
    }
    vy += FEEL.gravity * h
    x += vx * h
    y += vy * h

    if (x < left) {
      x = left
      if (vx < 0) {
        const impact = Math.abs(vx)
        vx = impact * FEEL.restitution
        emit({ type: 'bounce', speed: impact, side: 'left' })
      }
    } else if (x > right) {
      x = right
      if (vx > 0) {
        const impact = Math.abs(vx)
        vx = -impact * FEEL.restitution
        emit({ type: 'bounce', speed: impact, side: 'right' })
      }
    }

    if (y < ceiling) {
      y = ceiling
      if (vy < 0) {
        const impact = Math.abs(vy)
        vy = impact * FEEL.restitution
        emit({ type: 'bounce', speed: impact, side: 'top' })
      }
    }

    if (y >= floor) {
      const impact = Math.abs(vy)
      y = floor
      if (impact >= FEEL.landVy && impact > 0) {
        vy = -impact * FEEL.restitution
        vx *= FEEL.floorFriction
        emit({ type: 'bounce', speed: impact, side: 'floor' })
        if (impact > FEEL.dizzyImpact) emit({ type: 'dizzy', speed: impact })
      } else {
        vy = 0
        vx = 0
        if (!landed) {
          landed = true
          done = true
          emit({ type: 'land', speed: impact })
          if (impact > FEEL.dizzyImpact) emit({ type: 'dizzy', speed: impact })
        }
      }
    }
  }

  return {
    advance(dtMs) {
      events = []
      if (done) return events
      const dt = Math.max(0, Math.min(50, Number(dtMs) || 0)) / 1000
      accumulator += dt
      while (accumulator >= STEP) {
        step(STEP)
        accumulator -= STEP
        elapsed += STEP
        if (done) break
      }
      if (!done && elapsed >= FEEL.flightMaxMs / 1000) {
        // 飞太久（比如垂直高抛）也要落地，不能在半空冻住。
        const impact = Math.abs(vy)
        done = true
        landed = true
        vx = 0
        vy = 0
        y = floor
        emit({ type: 'land', speed: impact })
        if (impact > FEEL.dizzyImpact) emit({ type: 'dizzy', speed: impact })
      }
      return events
    },
    stop() {
      done = true
      vx = 0
      vy = 0
    },
    get x() { return x },
    get y() { return y },
    get vx() { return vx },
    get vy() { return vy },
    get elapsed() { return elapsed },
    get done() { return done },
    get landed() { return landed },
    /** 落地挤压量：冲击越大压得越扁，0.04–0.18。 */
    impactFor(impact) {
      return clamp(0.04 + Math.max(0, impact) / 9000, 0.04, FEEL.squashMax)
    },
    /** 落地尘土数量。 */
    dustFor(impact) {
      return clamp(Math.round(Math.max(0, impact) / 600), 1, 4)
    },
    bounds() {
      return { left, right, floor, ceiling }
    },
  }
}
