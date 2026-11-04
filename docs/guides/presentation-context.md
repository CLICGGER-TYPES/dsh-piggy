# Presentation context (F03)

Status: source layout for the current single-pig UI. This does not add a
multi-pig selector, network room, persistent identity or new interaction.

## Why

The current product mounts one pig, but one mounted pig must not depend on
module-global "last pig" slots. F03 makes the presentation an explicitly owned
instance so future local pigs and future remote owners can have independent
DOM, rendered state, animation feedback, timers and cleanup.

The normal `mountGame()` path and the authored dual-instance fixture both use
the same exported factory:

```js
import { createPresentationContext } from './presentation-context.js'

const presentation = createPresentationContext({
  root,          // optional explicit DOM root; omitted => document.body
  state,         // { getView?, isStopped?, isAway?, isQuiet? }
  transport,     // { send? } — host command seam, not a state store
  getShell,      // optional desktop/stage shell seam
  onGeometry,    // optional geometry notification
})
```

`root` must be an element in the current document (the normal mount uses
`document.body`). `presentation` owns:

| Item | Owner |
| --- | --- |
| scene DOM, host, style/font element | this presentation |
| current forced feedback / effect art / swap hook / selection generation | `presentation.art` |
| reaction and particle timers, transform layer | `presentation.effects` |
| spring/flight/swap/listener lifecycle | `presentation.feel` |
| birthday timer | `presentation.createBirthday(ui, render)` |
| read view + stopped/away/quiet queries | caller-supplied `state` binding |
| commands to the host | caller-supplied `transport` binding |

Device-wide custom-art measurement caches (`frameCustomImage`, `artFrameFor`)
stay shared: they are keyed by immutable image source and contain no pig
identity or owner resources.

## Lifetime and stale work

- `dispose()` sets the disposed flag before clearing timers, listeners and the
  art swap hook. It is idempotent.
- A queued art swap checks the context's disposed flag and the newest selection
  token for that image before writing `src`/frame.
- A delayed custom-art measurement checks the instance is alive, the selection
  is still current, and the image still points at the measured source.
- Delayed effects, birthday, feel and flight callbacks check their owner's
  stopped/disposed state before touching DOM.
- Disposing A removes only A's host/style/font and unregisters only A's pig.
  B remains mounted and usable.
- A pig may have exactly one live art context. Creating a second live context
  for the same pig is rejected before registration side effects.
- After A is disposed, the same pig can bind a fresh context. Late calls on the
  old controller are no-ops, and disposing A again must not unregister, mark or
  clear the fresh owner.

## Compatibility with existing consumers

`art.js` keeps `syncPigArt`, `forceFeedbackArt`, `setArtSwapHook`,
`showEffectArt` and `clearEffectArt` for standalone/direct consumers and for
modules outside this task's editable set. `syncPigArt` resolves an explicitly
registered pig through a `WeakMap` to its own art context; an unregistered pig
keeps the old standalone behavior. A disposed pig is never routed to another
live context.

`feel/dizzy.js` is an explicit consumer too: `createFeel` passes the
presentation's art controller, and dizzy calls that controller's
`showEffectArt`/`clearEffectArt`/`sync`. When no controller is supplied (legacy
standalone use), it keeps the old per-pig `syncPigArt` plus module-level
show/clear path. There is no global one-shot request in the normal path.

`life.js`, `panel.js`, `panel-empty.js` and `tabs/skins.js` are not edited:
their per-pig `syncPigArt` calls resolve through the same `WeakMap`, and the
frame cache/measurement helpers remain device-wide.

## Fixture

`test/unit/client/presentation-context.test.js` authors two explicit roots and two distinct
state bindings, checks independent feedback and queued swaps, and checks that
disposing A leaves B usable. It is author-only in this source handoff; the
developer did not execute it. Independent V03/PI-04 should run it together with
the corrected `test/unit/host/owner-resources.test.js` on the frozen candidate.

## Not in this slice

- public multi-pig selector or UI
- network room/auth/protocol or stable save IDs
- owner/currency/inventory/garden authority or per-view settlement
- sound policy (F05) or action/skin descriptors (F04)
- helper gameplay/art/patrol
