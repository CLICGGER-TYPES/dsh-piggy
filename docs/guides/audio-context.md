# Audio context and per-pig channels (F05)

Status: source layout for the current single-pig UI plus future local/online
multiple pigs. This does not add a multi-pig selector, network room, new sound,
new setting or a second `AudioContext`.

## Why

The old `sound.js` kept one module-global `AudioContext`, one master, one
`lastAt` debounce table and one `quietCheck`. That was fine with one mounted pig,
but it meant the last configured pig's quiet state and the last pig's effect
debounce could control every pig. F05 keeps the device services shared and makes
playback ownership explicit.

| Layer | Owner | What is shared |
| --- | --- | --- |
| Device | module `audio-context.js` | one lazy `AudioContext`, master gain, compressor, device-wide voice budget, channel registry |
| Channel | one actual presentation instance | quiet callback, per-key `lastAt`, active voice set, disposed flag |
| Legacy wrapper | `sound.js` | one default channel for old imports; `resetSound()` explicitly shuts down the device |

A channel is bound by object ownership to the presentation that created it. It
is not keyed by nickname, file path, runtime id or "last mounted" selector.

## API

```js
import { createAudioChannel, resetAudioDevice } from './audio-context.js'

const channel = createAudioChannel({
  isQuiet: () => view.dialogue.quiet === true,
})

channel.play('tap')                 // boolean, never throws for missing audio
channel.play('flip', { soft: true })
channel.unlock()                    // AudioContext|null; called from a real gesture
channel.stop()                      // stop only this channel's voices
channel.dispose()                   // stop + unregister; idempotent
```

Constants:

- `AUDIO_DEBOUNCE_MS = 60` — per-channel, per-recipe repeat interval.
- `AUDIO_VOICE_BUDGET = 3` — device-wide safety threshold checked before a new
  effect starts. It is intentionally not multiplied by pig count.

Existing `sound.js` exports remain compatible wrappers over one default channel:

```js
import { configureSound, playSound, resetSound, unlockSound } from './sound.js'
```

`configureSound()` only changes the default wrapper channel. A live presentation
channel never reads that global callback.

## Normal path

`createPresentationContext()` creates `presentation.audio` from its own
`state.isQuiet` and owns the channel lifetime. The normal `mountGame()` path
passes the same channel into:

- `presentation.feel` for tap/lift/land/flip/toss/bounce/catch and dizzy;
- `createDizzy` for the dizzy cue;
- `attachGestures` for pointerdown unlock and purr.

The small `playAudioCue(channel, ...)` / `unlockAudioCue(channel)` helpers route
an explicitly supplied channel; only a direct legacy consumer with no channel
falls back to the default wrapper. The normal path always supplies the
presentation channel, so there is no last-configured-pig bridge.

Panel/extension windows remain silent through the existing `allowedRole()`
check (`desktopRole()` must be `null` or `pet`). A settings toggle still uses the
device-global legacy `unlockSound()` because the device is legitimate shared
state; it does not become a per-pig playback route.

With sound OFF (the default), `play()`/`unlock()` do not construct a context.
Once sound is ON, an allowed call (a real gesture or the settings toggle) may
construct or resume the shared context; the browser's autoplay policy still
decides whether audible playback actually starts. A scheduled source or
`play()` returning `true` is not proof of audible sound. A suspended shared
context is resumed on the next allowed call. Missing or failing audio
construction returns `false`/`null` without throwing.

## Lifetime rules

- `channel.stop()` retires only that channel's active and scheduled sources. It
  never closes the context, disables another channel or changes the device
  settings.
- `channel.dispose()` is idempotent. It stops that channel's voices, unregisters
  it and makes later `play()`/`unlock()` calls no-ops. It never closes the
  shared device.
- `presentation.dispose()` disposes its own channel before clearing the rest of
  the presentation. Disposing A leaves B's DOM, voices, channel and future
  playback usable.
- `resetAudioDevice()` is the explicit device shutdown. It stops every
  registered channel, clears every channel's debounce table, closes the one
  context and can be called repeatedly. Channels remain usable for a later
  fresh device; tests/hot reload use `resetSound()` for this.
- Each synthesised voice retires exactly once. A natural `onended`, a channel
  stop and a device reset can all reach the same voice: the `done` flag keeps the
  device count non-negative and the channel set consistent. Retirement stops and
  disconnects the source, filter and gain; a late `onended` is a no-op.

## Debounce versus voice budget

These are different limits on purpose:

- **60 ms debounce** is per channel and per recipe key. A repeated `tap` on A is
  suppressed on A only; B can play `tap` in the same window.
- **3-voice device budget** is checked once before a recipe starts, across all
  channels. Recipes may then create more than one voice as before (for example
  `land-hard` has two tones and noise). This preserves the old device safety
  behaviour; it is not three voices per pig.
- If the device budget is full, playback is refused. An unrelated same-key
  debounce on A must not be the reason B is dropped, and the budget must recover
  after stop/natural end/reset.

## Compatibility

- Sound still defaults OFF; the existing device setting and volume 0/1/2 remain
  unchanged. No per-pig sound setting is saved.
- Existing RECIPES, `VOLUME_GAIN`, tone/noise timings, `soft` 0.65 multiplier,
  compressor settings, `+0.005` start offset and allowed-role policy are reused.
- `playSound`/`configureSound`/`resetSound`/`unlockSound` keep their signatures
  for standalone/direct consumers. The normal mount path no longer calls
  `configureSound`, so a module-global quiet callback cannot control all pigs.
- `src/client/effects.js` and birthday are unchanged because they have no actual
  sound consumer.
- No remote code/eval, new network call, asset download or schema change.

## Tests

`test/unit/client/audio-context.test.js` authors explicit A/B channels and presentation
instances for independent debounce/quiet, A-only stop/dispose, one shared
context, the device-wide voice budget, OFF/role/unavailable-context behaviour,
idempotent reset and the normal-path wiring. The developer did **not** execute
product tests; independent V05 runs them on the frozen candidate.

## Not in this slice

- new recipes, sounds, volume defaults, settings or UI
- per-pig persisted loudness or syncing device loudness to remote pig state
- a cross-process audio service, autoplay without a gesture or per-pig contexts
- public multi-pig selector, room/session identity or network playback
- product build/package/install and installed-UI acceptance
