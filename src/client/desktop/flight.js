// @ts-check
/**
 * A2 抛掷的纯物理：脚底中心的位置、重力、屏幕边反弹、落地和摔晕判定。
 *
 * 不含 DOM、不含窗口、不含弹簧手感；60/120/144Hz 都按固定 1/120 秒子步推进，
 * 页面只负责把算出来的位置发给外壳。这样这段逻辑可以在 Node 里直接测。
 * @module dsh-piggy/client/desktop/flight
 */
import { FEEL } from '../feel/config.js'
import { drawingCorridor } from './geometry.js'

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
 *   areas?:Array<{x:number,y:number,width:number,height:number}>,
 *   pig:{width:number,height:number,x?:number,y?:number}, artMargin?:number,
 *   visual?:{x:number,y:number,width:number,height:number},
 * }} options
 */
export function createFlight(options) {
  const areas = options.areas?.length ? options.areas : [options.area]
  const area = options.area
  const pig = options.pig
  const artMargin = Number.isFinite(options.artMargin) ? options.artMargin : 0
  const visual = options.visual
  const left = visual ? (pig.x ?? 0) + pig.width / 2 - visual.x : pig.width / 2 + artMargin
  const right = visual ? visual.x + visual.width - (pig.x ?? 0) - pig.width / 2 : pig.width / 2 + artMargin
  const head = visual ? (pig.y ?? 0) + pig.height - visual.y : pig.height + 8
  const foot = visual ? visual.y + visual.height - (pig.y ?? 0) - pig.height : 0
  const reach = Math.min(area.width / 2, Math.max(left, right))
  const horizontal = (x, y) => drawingCorridor(areas, true, y - head, y + foot, reach, reach, x)
  const vertical = (x, y) => drawingCorridor(areas, false, x - reach, x + reach, head, foot, y)
  let x = options.x
  let y = options.y
  // 拖放可以略微越过边缘，起飞时只夹回最近的有效走廊。
  const initialY = vertical(x, y) ?? [area.y + head, area.y + area.height - foot]
  y = clamp(y, initialY[0], initialY[1])
  const initialX = horizontal(x, y) ?? [area.x + reach, area.x + area.width - reach]
  x = clamp(x, initialX[0], initialX[1])
  const floor = initialY[1]

  const speed = Math.hypot(options.vx, options.vy)
  const scale = speed > FEEL.throwMax ? FEEL.throwMax / speed : 1
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
    const [left, right] = horizontal(x, y)
    x += vx * h

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

    const [ceiling, floor] = vertical(x, y)
    y += vy * h
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
        y = vertical(x, y)[1]
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
      const [left, right] = horizontal(x, y)
      const [ceiling, floor] = vertical(x, y)
      return { left, right, floor, ceiling }
    },
  }
}
