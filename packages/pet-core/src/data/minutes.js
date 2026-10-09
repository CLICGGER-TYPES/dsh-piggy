// @ts-check
/**
 * 时间常量 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/data/minutes
 */

export const MINUTES = Object.freeze({
  quarter: 15,
  half: 30,
  fortyFive: 45,
  hour: 60,
  ninety: 90,
  twoHours: 120,
  threeHours: 180,
  fourHours: 240,
  fiveHours: 300,
  sixHours: 360,
  eightHours: 480,
  halfDay: 720,
  day: 1440,
})

// ---------------------------------------------------------------------------
// Illness — three chains of four stages, straight from the reverse engineering.
// ---------------------------------------------------------------------------
