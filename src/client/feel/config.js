// @ts-check
/**
 * Q 弹手感的参数。默认值按用户 2026-10-18 拍板：压扁 18%、拉长 10%、
 * 倾斜 18 度、回弹 2~3 下。弹簧参数交给 Motion，这里只描述「多大、多快」。
 * @module dsh-piggy/client/feel/config
 */

export const FEEL = Object.freeze({
  /** 压扁（正）上限，用户拍板 18%。 */
  squashMax: 0.18,
  /** 拎起拉长上限，用户拍板 10%。 */
  holdMax: 0.1,
  /** 按压量。 */
  pressSquash: 0.04,
  /** 横向缩放 = 1 + volumeK * 压扁；小于 1 更像圆滚滚的动物。 */
  volumeK: 0.72,
  /** 拎起时横向收窄的比例。 */
  holdNarrow: 0.4,
  /** 拖动倾斜上限（度）。 */
  tiltMaxDrag: 18,
  /** 飞行倾斜上限（度）。 */
  tiltMaxFly: 20,
  /** 屏幕水平速度 → 倾斜角（度 / (px/s)）。 */
  tiltGain: 0.012,
  /** 按压弹簧。 */
  press: Object.freeze({ stiffness: 600, damping: 26, mass: 1 }),
  /** 挤压/拉长弹簧：欠阻尼，2~3 次可见回弹，约 0.75s 收住。 */
  squash: Object.freeze({ stiffness: 260, damping: 14, mass: 1 }),
  /** 拎起弹簧：接近临界阻尼，不上下晃。 */
  hold: Object.freeze({ stiffness: 300, damping: 26, mass: 1 }),
  /** 倾斜弹簧：松手约 0.45s 回正。 */
  tilt: Object.freeze({ stiffness: 220, damping: 16, mass: 1 }),
  /** 落地冲击弹簧：同样 2~3 次回弹。 */
  impact: Object.freeze({ stiffness: 260, damping: 14, mass: 1 }),
  /** 翻卡片。 */
  turnMs: 180,
  turnBulge: 0.04,
  /** 动作图切换遮挡。 */
  swapMs: 90,
  swapApplyMs: 55,
  swapMaxDelayMs: 140,
  /** 手势阈值。 */
  dragPx: 4,
  liftPx: 6,
  /** 来回摸：1200ms 内累计 320px，800ms 冷却。 */
  strokeWindowMs: 1200,
  strokePx: 320,
  strokeCooldownMs: 800,
  /** 桌面抛掷。 */
  throwMin: 180,
  throwMax: 2200,
  gravity: 2400,
  airDrag: 0.12,
  restitution: 0.52,
  floorFriction: 0.82,
  landVy: 520,
  dizzyImpact: 1500,
  dizzyMs: 2400,
  flightMaxMs: 3500,
  /** 轻柔模式缩放。 */
  softScale: 0.6,
  /** 收尾判定：所有通道小于这些值就算回稳。 */
  settleEpsilon: 0.004,
  settleTilt: 0.35,
})

/** 手感模式缩放：soft 把幅度压到 60%。 */
export function modeScale(mode) {
  return mode === 'soft' ? FEEL.softScale : 1
}
