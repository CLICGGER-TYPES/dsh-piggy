// @ts-check
/**
 * 音效入口：程序合成（Web Audio），默认关，免打扰不响，面板/扩展窗口不响。
 *
 * 页面刷新后第一次真实点击之前不创建 AudioContext（浏览器要求手势），
 * 设置里打开音效也算一次手势。Context 不可用时静默丢弃，不报错。
 * @module dsh-piggy/client/sound
 */
import { desktopRole } from './desktop-shell.js'
import { soundSettings } from './feel/settings.js'
import { RECIPES, VOLUME_GAIN } from './sounds.js'

var context = null
var master = null
var compressor = null
var lastAt = Object.create(null)
var voices = 0
var quietCheck = function () { return false }

/** 面板窗口、扩展窗口不响；网页版没有 role，按猪窗口算。 */
function allowedRole() {
  var role = desktopRole()
  return role === null || role === 'pet'
}

/** @param {{ isQuiet?: () => boolean }} options */
export function configureSound(options) {
  if (typeof options?.isQuiet === 'function') quietCheck = options.isQuiet
}

/** 第一次真实点击时调用：已打开音效才创建/恢复 AudioContext。 */
export function unlockSound() {
  if (!soundSettings().on) return null
  return ensureContext()
}

function ensureContext() {
  if (context !== null) {
    if (context.state === 'suspended') context.resume?.().catch?.(function () {})
    return context
  }
  try {
    var audioWindow = typeof window !== 'undefined' ? /** @type {any} */ (window) : null
    var Ctor = audioWindow === null ? null : (audioWindow.AudioContext || audioWindow.webkitAudioContext)
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
    if (context.state === 'suspended') context.resume?.().catch?.(function () {})
    return context
  } catch {
    context = null
    master = null
    compressor = null
    return null
  }
}

function noiseBuffer(ctx, seconds) {
  var length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  var buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  var data = buffer.getChannelData(0)
  var seed = 0x9e3779b9
  for (var i = 0; i < length; i += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    data[i] = (seed / 0xffffffff) * 2 - 1
  }
  return buffer
}

function tone(ctx, destination, spec, start, volume) {
  var osc = ctx.createOscillator()
  var gain = ctx.createGain()
  var duration = spec.ms / 1000
  osc.type = spec.type
  osc.frequency.setValueAtTime(Math.max(20, spec.from), start)
  if (spec.to !== spec.from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.to), start + duration)
  var peak = Math.max(0.0001, spec.gain * volume)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, duration * 0.2))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain)
  gain.connect(destination)
  osc.start(start)
  osc.stop(start + duration + 0.02)
  voices += 1
  osc.onended = function () { voices = Math.max(0, voices - 1) }
}

function noise(ctx, destination, spec, start, volume) {
  var source = ctx.createBufferSource()
  var filter = ctx.createBiquadFilter()
  var gain = ctx.createGain()
  var duration = spec.ms / 1000
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
  source.start(start)
  source.stop(start + duration + 0.01)
  voices += 1
  source.onended = function () { voices = Math.max(0, voices - 1) }
}

/**
 * 播一个音效。默认关时完全不碰 AudioContext。
 * @param {string} key
 * @param {{ soft?: boolean }} [options]
 */
export function playSound(key, options) {
  var recipe = RECIPES[key]
  if (recipe === undefined) return false
  var settings = soundSettings()
  if (!settings.on) return false
  if (!allowedRole() || quietCheck() === true) return false
  var now = Date.now()
  if (now - (lastAt[key] ?? 0) < 60) return false
  if (voices >= 3) return false
  var ctx = ensureContext()
  if (ctx === null || master === null) return false
  lastAt[key] = now
  var level = VOLUME_GAIN[settings.volume] ?? VOLUME_GAIN[2]
  var volume = level * (options?.soft === true ? 0.65 : 1)
  var start = ctx.currentTime + 0.005
  for (var i = 0; i < recipe.tones.length; i += 1) {
    tone(ctx, master, recipe.tones[i], start + (recipe.tones[i].delay ?? 0) / 1000, volume)
  }
  if (recipe.noise !== undefined) noise(ctx, master, recipe.noise, start, volume)
  return true
}

/** 测试和热更新用：把模块状态清干净。 */
export function resetSound() {
  try { context?.close?.() } catch { /* already closed */ }
  context = null
  master = null
  compressor = null
  lastAt = Object.create(null)
  voices = 0
}
