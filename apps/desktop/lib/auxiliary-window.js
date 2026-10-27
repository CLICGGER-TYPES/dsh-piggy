// @ts-check
/**
 * Electron's skipTaskbar is not implemented on Linux. Mutter treats a normal
 * inactive window as needing attention on each remap, producing an "is ready"
 * notification. A toolbar has the intended auxiliary-window semantics and is
 * genuinely excluded from GNOME's taskbar while remaining focusable on click.
 * Keep Windows/macOS window types unchanged.
 */
export function auxiliaryWindowOptions(platform) {
  return platform === 'linux' ? { type: 'toolbar' } : {}
}
