# Countdown motion

Source: `src/components/Countdown/Countdown.tsx`, `motion.ts` and `countdown.module.less`. Base layout, digit rolling and color reminders remain in [feedback.md](feedback.md). Full nested declarations with defaults are in the [published motion reference](https://github.com/guokaigdg/animal-island-ui/blob/main/skills/animal-island-ui-style/references/components/countdown-motion.md).

# Configuration groups

| Prop | Contract |
| --- | --- |
| `reminder` | Existing boolean or `{ seconds, color }[]`; controls digit, separator and enabled tile-border colors. |
| `shake` | Existing boolean/number, or `CountdownShakeOptions`: start/escalation thresholds, normal/urgent period, distance, rotation and CSS easing. |
| `endingAnimation` | Boolean or `CountdownEndingAnimationOptions`: recurring completion-style rebound and ripples in the final seconds, plus full visual parameters. |
| `finishAnimation` | Boolean or `CountdownEffectOptions`: the same configurable visuals played once when a positive countdown reaches zero. |

All four default to false. Existing shorthand usage keeps its prior behavior. `endingAnimation={true}` starts at 5 displayed seconds and repeats every 1000ms until zero. It does not implicitly enable shaking or a completion effect; compose the desired props. Thresholds use ceiling-rounded displayed seconds, never start early, and non-positive thresholds disable the corresponding stage.

# Default visual sequence

| Element | Defaults and configurable properties |
| --- | --- |
| Shake | Last 5 seconds: 1000ms period, ±1.5px horizontal displacement, ±0.6° rotation; last 3 seconds: 650ms / ±2.5px / ±0.9°. The active burst occupies the first 30% of the period. Setting urgentSeconds to zero removes escalation. |
| Bounce | Enabled; 350ms. At 30% press down 1px and scale to 0.94; at 65% rise 2px and scale to 1.05; finish at original scale/position. Duration, both scales and both offsets are configurable. |
| Ripples | Enabled; 2 rounded outlines, each 600ms, staggered by 150ms. 2px border, 5px outside gap, 16px radius, opacity 0.45 fading to zero, scale 0.98 to (1.08, 1.35). Count, duration, delay, color, opacity, width, offset, radius and scales are configurable. |
| Color | A ripple color overrides the active reminder color, which otherwise takes precedence over `--animal-primary-color`. Digits keep their independent reminder configuration. |
| Easing | `var(--animal-motion-ease, cubic-bezier(0.4, 0, 0.2, 1))`, independently configurable for shake and effects. |
| Retention | 900ms. Automatically extended to include the complete bounce, final delayed ripple and reduced-motion fade. Ending interval is at least this retention and 16ms. |

Each effect supports independent `bounce={false}` and `ripple={false}`. Ripple count is an integer between 0 and 10; zero removes ripples. Other non-finite numbers use defaults; negative unsigned values clamp to zero, opacity to 0–1 and rotation to 0–360. Numeric configuration caps at 60000 (signed offsets permit -60000); the legacy numeric shake shortcut retains its existing finite-threshold behavior. This bounds DOM decoration count and timer values without replacing user-supplied CSS colors or easing strings. Empty CSS strings fall back to defaults.

# State and lifecycle

The inner digit group shakes while an outer inline-flex motion layer rebounds. Ripples are absolutely positioned spans with pointer events disabled; they never participate in layout or accessibility content. Alternating animation names restart bounces and keyed decorations restart ripples, while preserving the existing rolling-digit DOM nodes and their progress.

The loop is active only while positive remaining seconds match the threshold. Disabling/resetting removes the current recurring effect; zero clears the loop and starts the independent completion effect, if enabled. Completion still fires `onFinish` once and removes its decorations after the calculated retention. Initial expired deadlines and enabling completion after zero do not replay it; equivalent Date objects identify the same deadline. Replacing configuration objects with equal values does not reset the loop cadence or completion timer.

Offscreen and hidden-page loops pause their CSS animations and stop their repetition timer. Returning starts a fresh visual cycle, without replaying missed cycles; the absolute countdown remains accurate. A completed one-shot is not replayed after return.

# Reduced motion and demonstration

`prefers-reduced-motion: reduce` disables shaking, recurring bounce and all ripples. Completion uses a 250ms fade from opacity 0.65 to 1 by default; `reducedMotion: 'none'` disables that too. Fade duration/opacity are configurable; no option overrides the system preference to force spatial motion.

The countdown demo adds an independent **最后几秒持续回弹与波纹** section with live switches, key numeric/color controls, full generated props and a nested-options API table. Original color, shake and completion examples remain available. The digit style, cream panel, spacing and typography continue to follow the existing Countdown design.
