// @ts-check
/**
 * 音效兼容入口：默认（设备级）通道的旧包装。
 *
 * 真正的设备混音器与每只展示实例的通道在 audio-context.js。默认关、免打扰、
 * 面板/扩展窗口不响的规则都不变；打开音效后，允许的 play/unlock（真实手势
 * 或设置开关）可能创建/恢复共享 AudioContext，是否真正出声仍由浏览器决定。
 * 正常 mountGame 路径不再调用 configureSound 设置「最后一只猪」的免打扰回调，
 * 而是由 presentation-context 为每只猪创建自己的通道。
 * @module dsh-piggy/client/sound
 */
import { defaultAudioChannel, resetAudioDevice } from './audio-context.js'

export { AUDIO_DEBOUNCE_MS, AUDIO_VOICE_BUDGET, createAudioChannel } from './audio-context.js'

/** 兼容旧调用：只改默认通道，不会覆盖任何已创建展示通道的 quiet。 */
export function configureSound(options) {
  if (typeof options?.isQuiet === 'function') defaultAudioChannel().setQuiet(options.isQuiet)
}

/** 第一次真实点击时调用：已打开音效才创建/恢复共享 AudioContext。 */
export function unlockSound() {
  return defaultAudioChannel().unlock()
}

/**
 * 播一个音效。默认关时完全不碰 AudioContext。
 * @param {string} key
 * @param {{ soft?: boolean }} [options]
 */
export function playSound(key, options) {
  return defaultAudioChannel().play(key, options)
}

/** 测试和热更新用：停掉所有通道、关闭共享设备并清干净去抖状态。 */
export function resetSound() {
  resetAudioDevice()
}
