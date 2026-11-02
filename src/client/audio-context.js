// @ts-check
/**
 * 设备混音器 + 每只展示实例的音频通道。
 *
 * 一个窗口只建一个 AudioContext / master / compressor（设备服务），每只实际
 * 展示的猪拿到自己的 channel：自己的 quiet、去抖表和声部集合。A 的
 * stop/dispose 只收 A 的声音，不关共享 context，也不影响 B。
 *
 * 旧 sound.js 的模块级入口仍然存在，但只是默认 channel 的兼容包装；正常
 * mountGame 路径由 presentation-context 显式创建并传递 channel。
 * @module dsh-piggy/client/audio-context
 */
import { desktopRole } from './desktop-shell.js'
import { soundSettings } from './feel/settings.js'
import { RECIPES, VOLUME_GAIN } from './sounds.js'

/** 同一通道、同一配方的最短重复间隔（沿用旧模块级去抖）。 */
export const AUDIO_DEBOUNCE_MS = 60
/** 设备级同时存在的合成声部安全上限；不是每只猪一份。 */
export const AUDIO_VOICE_BUDGET = 3

/** @typedef {{ context: any, master: any, compressor: any }} Device */
/** @typedef {{ source: any, gain: any, filter: any, state: ChannelState, done: boolean }} Voice */
/** @typedef {{ quiet: () => boolean, lastAt: Record<string, number>, active: Set<Voice>, disposed: boolean }} ChannelState */

/** @type {Device|null} */
let device = null
let voices = 0
/** @type {Set<any>} */
const channels = new Set()
/** @type {WeakMap<object, ChannelState>} */
const states = new WeakMap()
/** @type {any} */
let defaultChannel = null

/** 面板窗口、扩展窗口不响；网页版没有 role，按猪窗口算。 */
function allowedRole() {
  const role = desktopRole()
  return role === null || role === 'pet'
}

function ensureDevice() {
  if (device !== null) {
    if (device.context.state === 'suspended') device.context.resume?.().catch?.(function () {})
    return device.context
  }
  let context = null
  let master = null
  let compressor = null
  try {
    const audioWindow = typeof window !== 'undefined' ? /** @type {any} */ (window) : null
    const Ctor = audioWindow === null ? null : (audioWindow.AudioContext || audioWindow.webkitAudioContext)
    if (typeof Ctor !== 'function') return null
    context = new Ctor()
    compressor = context.createDynamicsCompressor?.() ?? null
    master = context.createGain()
    master.gain.value = 1
    if (compressor !== null) {
      compressor.threshold.value = -18
      compressor.knee.value = 12
      compressor.ratio.value = 6
      compressor.attack.value = 0.003
      compressor.release.value = 0.2
      master.connect(compressor)
      compressor.connect(context.destination)
    } else {
      master.connect(context.destination)
    }
    device = { context: context, master: master, compressor: compressor }
    if (context.state === 'suspended') context.resume?.().catch?.(function () {})
    return context
  } catch {
    try { context?.close?.() } catch { /* partially created context */ }
    device = null
    return null
  }
}

/**
 * Retire one voice exactly once. stop() and a late onended can race; the done
 * flag makes the device count and channel set idempotent.
 * @param {Voice} voice
 */
function retireVoice(voice) {
  if (voice.done) return
  voice.done = true
  voice.state.active.delete(voice)
  voices = Math.max(0, voices - 1)
  try { voice.source.stop?.() } catch { /* already stopped or ended */ }
  try { voice.source.disconnect?.() } catch { /* already disconnected */ }
  try { voice.filter?.disconnect?.() } catch { /* already disconnected */ }
  try { voice.gain.disconnect?.() } catch { /* already disconnected */ }
}

/** @param {ChannelState} state @param {any} source @param {any} gain @param {any} filter */
function registerVoice(state, source, gain, filter) {
  const voice = { source: source, gain: gain, filter: filter, state: state, done: false }
  state.active.add(voice)
  voices += 1
  source.onended = function () { retireVoice(voice) }
  return voice
}

function noiseBuffer(ctx, seconds) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let seed = 0x9e3779b9
  for (let i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    data[i] = (seed / 0xffffffff) * 2 - 1
  }
  return buffer
}

/** @param {any} ctx @param {any} destination @param {any} spec @param {number} start @param {number} volume @param {ChannelState} state */
function startTone(ctx, destination, spec, start, volume, state) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const duration = spec.ms / 1000
  osc.type = spec.type
  osc.frequency.setValueAtTime(Math.max(20, spec.from), start)
  if (spec.to !== spec.from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start + duration)
  const peak = Math.max(0.0001, spec.gain * volume)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, duration * 0.2))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(destination)
  const voice = registerVoice(state, osc, gain, null)
  try {
    osc.start(start)
    osc.stop(start + duration + 0.02)
  } catch (error) {
    retireVoice(voice)
    throw error
  }
  return voice
}

/** @param {any} ctx @param {any} destination @param {any} spec @param {number} start @param {number} volume @param {ChannelState} state */
function startNoise(ctx, destination, spec, start, volume, state) {
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  const duration = spec.ms / 1000
  source.buffer = noiseBuffer(ctx, duration)
  filter.type = spec.type ?? 'lowpass'
  filter.frequency.setValueAtTime(Math.max(40, spec.from), start)
  if (spec.to !== spec.from) filter.frequency.exponentialRampToValueAtTime(Math.max(40, spec.to), start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, spec.gain * volume), start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  const voice = registerVoice(state, source, gain, filter)
  try {
    source.start(start)
    source.stop(start + duration + 0.01)
  } catch (error) {
    retireVoice(voice)
    throw error
  }
  return voice
}

/** @param {ChannelState} state @param {any} recipe @param {number} volume */
function startRecipe(state, recipe, volume) {
  if (device === null) return false
  const ctx = device.context
  const start = ctx.currentTime + 0.005
  const created = []
  try {
    for (let i = 0; i < recipe.tones.length; i += 1) {
      created.push(startTone(ctx, device.master, recipe.tones[i], start + (recipe.tones[i].delay ?? 0) / 1000, volume, state))
    }
    if (recipe.noise !== undefined) created.push(startNoise(ctx, device.master, recipe.noise, start, volume, state))
    return true
  } catch {
    for (let i = 0; i < created.length; i += 1) retireVoice(created[i])
    return false
  }
}

/** @param {ChannelState} state */
function stopState(state) {
  const active = Array.from(state.active)
  for (let i = 0; i < active.length; i += 1) retireVoice(active[i])
}

/** @param {ChannelState} state @param {string} key @param {{ soft?: boolean }|undefined} options */
function playChannel(state, key, options) {
  if (state.disposed) return false
  const recipe = RECIPES[key]
  if (recipe === undefined) return false
  const settings = soundSettings()
  if (!settings.on) return false
  if (!allowedRole() || state.quiet() === true) return false
  const now = Date.now()
  if (now - (state.lastAt[key] ?? 0) < AUDIO_DEBOUNCE_MS) return false
  if (voices >= AUDIO_VOICE_BUDGET) return false
  if (ensureDevice() === null) return false
  const level = VOLUME_GAIN[settings.volume] ?? VOLUME_GAIN[2]
  const volume = level * (options?.soft === true ? 0.65 : 1)
  if (!startRecipe(state, recipe, volume)) return false
  state.lastAt[key] = now
  return true
}

/**
 * One explicit audio owner, normally one presentation instance.
 * @param {{ isQuiet?: () => boolean }} [options]
 */
export function createAudioChannel(options) {
  const opts = options ?? {}
  /** @type {ChannelState} */
  const state = {
    quiet: typeof opts.isQuiet === 'function' ? opts.isQuiet : function () { return false },
    lastAt: Object.create(null),
    active: new Set(),
    disposed: false,
  }
  const channel = {
    get disposed() { return state.disposed },
    isQuiet: function () { return state.quiet() === true },
    /** Legacy configureSound seam; presentation channels bind at creation instead. */
    setQuiet: function (check) {
      if (typeof check === 'function' && !state.disposed) state.quiet = check
      return channel
    },
    play: function (key, playOptions) { return playChannel(state, key, playOptions) },
    unlock: function () {
      if (state.disposed) return null
      if (!soundSettings().on) return null
      return ensureDevice()
    },
    stop: function () { stopState(state) },
    dispose: function () {
      if (state.disposed) return
      state.disposed = true
      stopState(state)
      channels.delete(channel)
    },
  }
  states.set(channel, state)
  channels.add(channel)
  return channel
}

/** Compatibility channel for src/client/sound.js. */
export function defaultAudioChannel() {
  if (defaultChannel === null) defaultChannel = createAudioChannel()
  return defaultChannel
}

/**
 * Route a cue to an explicit channel. A direct legacy consumer without a
 * channel keeps the old default wrapper; the normal mount path always passes
 * the presentation channel.
 * @param {any} channel @param {string} key @param {{ soft?: boolean }} [options]
 */
export function playAudioCue(channel, key, options) {
  if (channel !== null && channel !== undefined && typeof channel.play === 'function') return channel.play(key, options)
  return defaultAudioChannel().play(key, options)
}

/** Same explicit-channel routing for gesture/settings unlock. @param {any} channel */
export function unlockAudioCue(channel) {
  if (channel !== null && channel !== undefined && typeof channel.unlock === 'function') return channel.unlock()
  return defaultAudioChannel().unlock()
}

/**
 * Explicit device shutdown: stop every channel, clear its debounce table and
 * close the one shared context. Idempotent, and channels stay usable for a
 * later device after a reset. It never runs from one presentation's dispose.
 */
export function resetAudioDevice() {
  channels.forEach(function (channel) {
    const state = states.get(channel)
    if (state === undefined) return
    stopState(state)
    state.lastAt = Object.create(null)
  })
  const current = device
  device = null
  voices = 0
  if (current !== null) {
    try { current.context.close?.() } catch { /* already closed */ }
  }
}
