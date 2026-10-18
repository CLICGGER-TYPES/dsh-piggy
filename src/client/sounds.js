// @ts-check
/**
 * 音效配方：全部程序合成，不引入音频文件。
 *
 * 每个配方只描述「几个振荡器/噪声 + 音量包络」；播放、去重、免打扰和
 * AudioContext 生命周期在 sound.js。配方是纯函数，测试里可以单独检查参数。
 * @module dsh-piggy/client/sounds
 */

/** 0/1/2 三档音量（轻/中/响）。 */
export const VOLUME_GAIN = Object.freeze([0.32, 0.55, 0.82])

/** @typedef {{ type: string, from: number, to: number, ms: number, gain: number, delay?: number, sweep?: string }} Tone */

/**
 * 一份配方：tone 列表 + 可选噪声。音量在播放时再乘总音量。
 * @type {Record<string, { tones: Tone[], noise?: { from:number, to:number, ms:number, gain:number, type?:string } }>}
 */
export const RECIPES = Object.freeze({
  tap: { tones: [{ type: 'sine', from: 660, to: 520, ms: 70, gain: 0.35 }] },
  lift: { tones: [{ type: 'triangle', from: 340, to: 760, ms: 110, gain: 0.4 }] },
  toss: { tones: [{ type: 'sine', from: 240, to: 120, ms: 120, gain: 0.2 }], noise: { from: 900, to: 260, ms: 220, gain: 0.28 } },
  bounce: { tones: [{ type: 'sine', from: 190, to: 105, ms: 110, gain: 0.5 }] },
  'land-soft': { tones: [{ type: 'sine', from: 130, to: 82, ms: 130, gain: 0.5 }] },
  'land-hard': { tones: [{ type: 'sine', from: 105, to: 55, ms: 170, gain: 0.65 }, { type: 'triangle', from: 300, to: 180, ms: 120, gain: 0.18 }], noise: { from: 420, to: 120, ms: 120, gain: 0.22 } },
  dizzy: { tones: [{ type: 'sine', from: 720, to: 560, ms: 150, gain: 0.32 }, { type: 'sine', from: 640, to: 480, ms: 180, gain: 0.3, delay: 130 }] },
  purr: { tones: [{ type: 'sawtooth', from: 72, to: 62, ms: 280, gain: 0.28 }] },
  flip: { tones: [], noise: { from: 2400, to: 700, ms: 90, gain: 0.22, type: 'highpass' } },
  catch: { tones: [{ type: 'square', from: 460, to: 380, ms: 70, gain: 0.28 }] },
})

/** 配方名列表，测试用。 */
export const SOUND_KEYS = Object.freeze(Object.keys(RECIPES))
