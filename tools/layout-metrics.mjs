// @ts-check
/**
 * 布局门禁的最小数值，和 tools/layout-image-audit.mjs 的素材内边距门槛
 * （普通场景 6px、大场景 8px）以及面板控件之间的最小间距保持一致。
 * 只在这里改数值；测试会盯住它不能低于审计口径。
 */
export const MIN_TEXT_PADDING = 6
export const MIN_BIG_TEXT_PADDING = 8
export const MIN_CONTROL_GAP = 4
