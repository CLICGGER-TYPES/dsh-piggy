// @ts-check
/** 桌面版专用样式：内置 emoji 字体栈；投影不越出可见区域；面板底栏限高。 */
const FONT_STACK = 'Nunito,"Noto Sans SC",-apple-system,"PingFang SC","Hiragino Sans GB",sans-serif'
/** 桌面版专用样式：内置 emoji 字体栈；投影不越出可见区域；面板底栏限高。 */
export const DESKTOP_CSS = [
  `[data-dsh-pig][data-dsh-pig]{--ac-font:"Piggy Emoji",${FONT_STACK}}`,
  `[data-dsh-pig][data-dsh-pig][data-emoji="system"]{--ac-font:${FONT_STACK}}`,
  '[data-dsh-pig][data-open="false"] .dp-pig{filter:none!important}',
  '[data-dsh-pig] .dp-pig-img,[data-dsh-pig] .dp-pig-emoji{filter:none!important}',
  // 上面两条只为去投影（F11），却把状态变色一起关了（2026-10-08 发现）：这里把变色补回来，不带投影。
  '[data-dsh-pig] .dp-pig[data-mood="sick"] .dp-pig-img,[data-dsh-pig] .dp-pig[data-mood="sick"] .dp-pig-emoji{filter:hue-rotate(-28deg) saturate(.75)!important}',
  '[data-dsh-pig] .dp-pig[data-mood="dirty"] .dp-pig-img,[data-dsh-pig] .dp-pig[data-mood="dirty"] .dp-pig-emoji{filter:sepia(.4)!important}',
  '[data-dsh-pig] .dp-pig[data-mood="dead"] .dp-pig-img,[data-dsh-pig] .dp-pig[data-mood="dead"] .dp-pig-emoji{filter:grayscale(1)!important}',
  '[data-dsh-pig][data-faded="true"] .dp-pig-emoji{filter:grayscale(.5) opacity(.72)!important}',
  '[data-dsh-pig][data-dsh-pig] .dp-pig[data-stage="grave"]{filter:grayscale(.35)!important}',
  '[data-dsh-pig] .dp-card{box-shadow:inset 0 1px 2px rgba(61,52,40,.09)!important}',
  '[data-dsh-pig] .dp-panel-footer{max-height:270px!important}',
  // 收起时拖猪，窗口缩到只包住猪；头顶的签到/礼包小气泡会被窗口边裁成半块白色，拖的时候先藏起来。
  '[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-daily,[data-dsh-pig] .dp-scene[data-dragging="true"] .dp-poke-hint{visibility:hidden!important}',
  // 猪窗口（外壳 0.6.0 起）：面板和名牌在另一个窗口里，这里永远只有猪。
  '[data-piggy-role="pet"] .dp-card,[data-piggy-role="pet"] .dp-hud{display:none!important}',
].join('\n')

