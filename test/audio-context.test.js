// @ts-check
/**
 * F05 audio ownership regression (author-only; the developer did not run it).
 * Two explicit channels/presentations stand in for two pigs: per-pig quiet and
 * debounce stay separate, while one device keeps the existing 3-voice safety
 * budget and a single AudioContext. Independent V05 should run this together
 * with the existing presentation/feel tests on the frozen candidate.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { createAudioChannel, resetAudioDevice } from '../src/client/audio-context.js'
import { setSoundSettings } from '../src/client/feel/settings.js'
import { configureSound, playSound, resetSound, unlockSound } from '../src/client/sound.js'
import { fakeDom } from './helpers/bundle.js'

function installWindow() {
  const store = new Map()
  class FakeParam {
    constructor(value) {
      this.value = value
      this.events = []
    }
    setValueAtTime(value, time) {
      this.value = value
      this.events.push({ kind: 'set', value, time })
      return this
    }
    exponentialRampToValueAtTime(value, time) {
      this.value = value
      this.events.push({ kind: 'ramp', value, time })
      return this
    }
  }
  class FakeNode {
    constructor() {
      this.connections = []
      this.disconnected = false
    }
    connect(target) {
      this.connections.push(target)
      return target
    }
    disconnect() {
      this.disconnected = true
    }
  }
  class FakeGain extends FakeNode {
    constructor() {
      super()
      this.gain = new FakeParam(1)
    }
  }
  class FakeOscillator extends FakeNode {
    constructor(context) {
      super()
      this.context = context
      this.frequency = new FakeParam(440)
      this.type = 'sine'
      this.started = false
      this.stopped = false
      this.stopCalls = 0
      this.onended = null
      context.sources.push(this)
    }
    start(time) {
      this.started = true
      this.startedAt = time
    }
    stop(time) {
      this.stopCalls += 1
      this.stoppedAt = time
      // WebAudio stop(futureTime) schedules the end; the source stays active
      // until then. retireVoice() uses stop() with no argument for an immediate
      // stop/reset, so the fixture must not mark a scheduled future stop as done.
      const scheduled = Number.isFinite(time) && time > this.context.currentTime
      this.stopScheduled = scheduled && !this.stopped
      this.scheduledStopAt = this.stopScheduled ? time : null
      if (!this.stopScheduled) this.stopped = true
    }
  }
  class FakeBufferSource extends FakeOscillator {
    constructor(context) {
      super(context)
      this.buffer = null
    }
  }
  class FakeFilter extends FakeNode {
    constructor() {
      super()
      this.type = 'lowpass'
      this.frequency = new FakeParam(350)
    }
  }
  class FakeCompressor extends FakeNode {
    constructor() {
      super()
      this.threshold = new FakeParam(-24)
      this.knee = new FakeParam(30)
      this.ratio = new FakeParam(12)
      this.attack = new FakeParam(0.003)
      this.release = new FakeParam(0.25)
    }
  }
  class FakeAudioContext {
    static instances = []
    constructor() {
      this.state = 'running'
      this.currentTime = 10
      this.sampleRate = 48000
      this.destination = new FakeNode()
      this.sources = []
      this.resumeCalls = 0
      this.closed = false
      FakeAudioContext.instances.push(this)
    }
    createGain() { return new FakeGain() }
    createOscillator() { return new FakeOscillator(this) }
    createBufferSource() { return new FakeBufferSource(this) }
    createBiquadFilter() { return new FakeFilter() }
    createDynamicsCompressor() { return new FakeCompressor() }
    decodeAudioData() { return Promise.resolve({ duration: 0.4 }) }
    createBuffer(channels, length, sampleRate) {
      assert.equal(channels, 1)
      return {
        length,
        sampleRate,
        getChannelData() { return new Float32Array(length) },
      }
    }
    resume() {
      this.resumeCalls += 1
      this.state = 'running'
      return Promise.resolve()
    }
    close() {
      this.closed = true
      this.state = 'closed'
      return Promise.resolve()
    }
  }
  globalThis.window = {
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
      removeItem: key => { store.delete(key) },
    },
    AudioContext: FakeAudioContext,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    __dshPiggyShell: null,
  }
  return {
    FakeAudioContext,
    setRole(role) {
      globalThis.window.__dshPiggyShell = role === null ? null : { role, beginDrag() {} }
    },
  }
}

function enableSound() {
  setSoundSettings({ on: true, volume: 2 })
}

function cleanup(t, env) {
  t.after(function () {
    resetAudioDevice()
    delete globalThis.window
    delete globalThis.document
    env.FakeAudioContext.instances.length = 0
  })
}

test('A and B have independent debounce/quiet; A stop/dispose leaves B and the device alive', async (t) => {
  const env = installWindow()
  cleanup(t, env)
  enableSound()

  const a = createAudioChannel({ isQuiet: () => false })
  const b = createAudioChannel({ isQuiet: () => false })
  assert.equal(a.play('tap'), true)
  assert.equal(a.play('tap'), false, 'A repeats of the same effect are debounced on A only')
  assert.equal(b.play('tap'), true, 'B is not dropped because A played the same key')
  assert.equal(env.FakeAudioContext.instances.length, 1, 'both channels share one device AudioContext')

  const context = env.FakeAudioContext.instances[0]
  const [aSource, bSource] = context.sources
  assert.equal(aSource.stopped, false)
  assert.equal(bSource.stopped, false)

  a.stop()
  assert.equal(aSource.stopped, true, 'A stop cancels A source')
  assert.equal(aSource.disconnected, true, 'A stop disconnects A source')
  assert.equal(bSource.stopped, false, 'A stop leaves B voice running')
  assert.equal(context.closed, false, 'A stop never closes the shared context')

  assert.equal(b.play('lift'), true, 'B still plays after A stop')
  a.dispose()
  assert.equal(context.closed, false, 'A dispose never closes the shared context')
  assert.equal(a.play('tap'), false, 'disposed A stays silent')
  assert.equal(b.play('flip'), true, 'B still plays after A dispose')
  assert.equal(env.FakeAudioContext.instances.length, 1)
})

test('the 3-voice safety budget is device-wide and recovers after stop/onended', async (t) => {
  const env = installWindow()
  cleanup(t, env)
  enableSound()

  const a = createAudioChannel()
  const b = createAudioChannel()
  const c = createAudioChannel()
  const d = createAudioChannel()
  const e = createAudioChannel()
  const f = createAudioChannel()

  assert.equal(a.play('tap'), true)
  assert.equal(b.play('tap'), true)
  assert.equal(c.play('tap'), true)
  assert.equal(d.play('tap'), false, 'the fourth simultaneous voice is refused across channels')
  const context = env.FakeAudioContext.instances[0]
  assert.equal(context.sources.length, 3)

  const [aSource, , cSource] = context.sources
  aSource.onended()
  aSource.onended()
  assert.equal(d.play('tap'), true, 'natural onended frees one device voice exactly once')

  const cStopCalls = cSource.stopCalls
  c.stop()
  const afterFirstStop = cSource.stopCalls
  assert.equal(afterFirstStop, cStopCalls + 1, 'channel stop retires the voice once')
  c.stop()
  assert.equal(cSource.stopCalls, afterFirstStop, 'a second channel stop does not retire the same voice twice')
  assert.equal(e.play('tap'), true)
  assert.equal(f.play('tap'), false)

  b.stop()
  assert.equal(f.play('tap'), true, 'stopping B frees its budget slot for F')
  assert.equal(env.FakeAudioContext.instances.length, 1, 'no per-pig AudioContext was created')
})

test('quiet callbacks are per channel; legacy configureSound only affects the default wrapper', async (t) => {
  const env = installWindow()
  cleanup(t, env)
  enableSound()

  let aQuiet = true
  const a = createAudioChannel({ isQuiet: () => aQuiet })
  const b = createAudioChannel({ isQuiet: () => false })
  assert.equal(a.play('tap'), false, 'A quiet rejects only A')
  assert.equal(b.play('tap'), true, 'B is not quiet')

  aQuiet = false
  assert.equal(a.play('lift'), true)
  a.stop()

  configureSound({ isQuiet: () => true })
  assert.equal(a.play('flip'), true, 'legacy configure must not overwrite live channel A quiet')
  assert.equal(b.play('lift'), true, 'legacy configure must not overwrite live channel B quiet')
  assert.equal(playSound('tap'), false, 'legacy playSound follows its own default channel')

  configureSound({ isQuiet: () => false })
  b.stop()
  assert.equal(playSound('tap'), true)
})

test('sound OFF, panel role and unavailable context stay silent without throwing', async (t) => {
  const offEnv = installWindow()
  t.after(function () {
    resetAudioDevice()
    delete globalThis.window
    delete globalThis.document
    offEnv.FakeAudioContext.instances.length = 0
  })
  const channel = createAudioChannel()
  assert.equal(channel.play('tap'), false)
  assert.equal(channel.unlock(), null)
  assert.equal(offEnv.FakeAudioContext.instances.length, 0, 'default OFF never creates AudioContext')

  enableSound()
  assert.equal(channel.play('tap'), true)
  offEnv.setRole('panel')
  const panel = createAudioChannel()
  assert.equal(panel.play('tap'), false, 'panel window is silent')
  offEnv.setRole('ext')
  assert.equal(panel.play('tap'), false, 'extension window is silent')
  offEnv.setRole('pet')
  assert.equal(panel.play('tap'), true, 'pet window is allowed')
  offEnv.setRole(null)
  const web = createAudioChannel()
  assert.equal(web.play('tap'), true, 'web/no-role window behaves as the pig window')

  resetSound()
  const unavailableEnv = installWindow()
  unavailableEnv.FakeAudioContext.instances.length = 0
  delete globalThis.window.AudioContext
  enableSound()
  const unavailable = createAudioChannel()
  assert.doesNotThrow(() => assert.equal(unavailable.play('tap'), false))
  assert.equal(unavailable.unlock(), null)
  assert.equal(unavailableEnv.FakeAudioContext.instances.length, 0)
})

test('reset stops every registered channel, closes one context, clears debounce and is idempotent', async (t) => {
  const env = installWindow()
  cleanup(t, env)
  enableSound()

  const a = createAudioChannel()
  const b = createAudioChannel()
  assert.equal(a.play('tap'), true)
  assert.equal(b.play('tap'), true)
  const context = env.FakeAudioContext.instances[0]
  const [aSource, bSource] = context.sources

  resetSound()
  assert.equal(aSource.stopped, true, 'reset stops A')
  assert.equal(bSource.stopped, true, 'reset stops B')
  assert.equal(aSource.disconnected, true)
  assert.equal(bSource.disconnected, true)
  assert.equal(context.closed, true, 'reset closes the one device context')
  assert.equal(env.FakeAudioContext.instances.length, 1)

  assert.equal(a.play('tap'), true, 'reset clears per-channel debounce and allows a fresh device')
  assert.equal(env.FakeAudioContext.instances.length, 2)
  resetSound()
  resetSound()
  assert.equal(env.FakeAudioContext.instances[1].closed, true)
  assert.equal(env.FakeAudioContext.instances.length, 2, 'repeated reset does not create contexts')
})

test('a presentation owns one channel; disposing A leaves the shared device and B usable', async (t) => {
  const env = installWindow()
  const dom = fakeDom()
  globalThis.document = dom.document
  cleanup(t, env)
  enableSound()

  const { createPresentationContext } = await import('../src/client/presentation-context.js')
  const leftRoot = dom.document.createElement('div')
  const rightRoot = dom.document.createElement('div')
  dom.body.appendChild(leftRoot)
  dom.body.appendChild(rightRoot)
  const left = createPresentationContext({ root: leftRoot, state: { isStopped: () => false, isQuiet: () => false } })
  const right = createPresentationContext({ root: rightRoot, state: { isStopped: () => false, isQuiet: () => false } })
  try {
    assert.notEqual(left.audio, right.audio, 'each presentation owns a distinct channel')
    assert.equal(left.audio.play('tap'), true)
    assert.equal(right.audio.play('tap'), true, 'B channel is not suppressed by A same key')
    assert.equal(left.audio.play('tap'), false)
    const context = env.FakeAudioContext.instances[0]
    left.dispose()
    assert.equal(context.closed, false, 'presentation dispose does not close the shared device')
    assert.equal(left.audio.play('tap'), false, 'disposed presentation channel is silent')
    assert.equal(right.audio.play('lift'), true, 'B presentation remains usable')
    assert.equal(env.FakeAudioContext.instances.length, 1)
  } finally {
    left.dispose()
    right.dispose()
  }
})

test('dizzy resolves playback through its own channel', async (t) => {
  const env = installWindow()
  cleanup(t, env)
  const calls = []
  const pig = {
    getAttribute: () => null,
    setAttribute() {},
    removeAttribute() {},
  }
  const art = { sync: () => true, showEffectArt() {}, clearEffectArt() {} }
  const { createDizzy } = await import('../src/client/feel/dizzy.js')
  const dizzy = createDizzy({
    pig,
    pigArt: null,
    pigEmoji: null,
    burst() {},
    getMode: () => 'soft',
    art,
    audio: { play: (key, options) => { calls.push({ key, options }); return true } },
  })
  try {
    dizzy.trigger()
    assert.deepEqual(calls, [{ key: 'dizzy', options: { soft: true } }])
  } finally {
    dizzy.dispose()
  }
})

test('the normal mount path uses the presentation channel, not a last-configured global', async () => {
  const [presentation, index, gestures, feel, dizzy] = await Promise.all([
    readFile(new URL('../src/client/presentation-context.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/gestures.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/feel/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/client/feel/dizzy.js', import.meta.url), 'utf8'),
  ])
  assert.match(presentation, /createAudioChannel\(\{ isQuiet: isQuiet \}\)/)
  assert.match(presentation, /audio: audio/)
  assert.match(presentation, /audio\.dispose\(\)/)
  assert.match(index, /audio: presentation\.audio/)
  assert.doesNotMatch(index, /configureSound/)
  assert.match(gestures, /unlockAudioCue\(c\.audio\)/)
  assert.match(gestures, /playAudioCue\(c\.audio, 'purr'\)/)
  assert.match(feel, /playAudioCue\(deps\.audio/)
  assert.match(dizzy, /playAudioCue\(c\.audio, 'dizzy'/)
})

test('文件音效先回退合成，解码后优先播放音频', async (t) => {
  const env = installWindow()
  cleanup(t, env)
  enableSound()
  globalThis.fetch = async function () {
    return { ok: true, arrayBuffer: async function () { return new ArrayBuffer(16) } }
  }
  t.after(function () { delete globalThis.fetch })
  const channel = createAudioChannel({
    isQuiet: () => false,
    soundFiles: {
      boom: { url: 'sounds/sfx/boom.ogg?v=abc', durationMs: 400, gain: 0.9, debounceMs: 0, fallback: 'synth:tap' },
    },
  })
  assert.equal(channel.play('boom'), true, '首次播放先用 synth 回退')
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(channel.play('boom'), true, '解码后播放文件 buffer')
  const context = env.FakeAudioContext.instances[0]
  assert.equal(context.sources.some(source => source.buffer !== null), true, '使用了 AudioBufferSource')
  channel.dispose()
})
