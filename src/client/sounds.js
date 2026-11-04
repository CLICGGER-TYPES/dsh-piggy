// @ts-check
/**
 * 音效配方：全部程序合成，不引入音频文件。
 *
 * 每个配方只描述「几个振荡器/噪声 + 音量包络」；播放、去重、免打扰和
 * AudioContext 生命周期在 audio-context.js（sound.js 保留兼容包装）。配方是
 * 纯数据，测试里可以单独检查参数。
 * @module dsh-piggy/client/sounds
 */

/** 0/1/2 三档音量（轻/中/响）。 */
export const VOLUME_GAIN = Object.freeze([0.32, 0.55, 0.82])

import { SOUND_FILES, SOUND_RECIPES } from './sounds.generated.js'
export { SOUND_FILES }

/** @typedef {{ type: string, from: number, to: number, ms: number, gain: number, delay?: number, sweep?: string }} Tone */

/**
 * 音效配方：唯一来源是 `assets/sounds/builtin/pack.json`，构建时生成
 * `sounds.generated.js`。播放、去重、免打扰和 AudioContext 生命周期在
 * audio-context.js（sound.js 保留兼容包装）。
 * @type {Record<string, { tones: Tone[], noise?: { from:number, to:number, ms:number, gain:number, type?:string } }>}
 */
export const RECIPES = SOUND_RECIPES

/** 配方名列表，测试用。 */
export const SOUND_KEYS = Object.freeze(Object.keys(RECIPES))
