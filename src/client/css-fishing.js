// @ts-check
/**
 * 钓鱼页样式（U24-7）：奶油底、棕色字、米色细边、青色主按钮。
 * 布局按用户确认的两张概念稿：292px 三列鱼饵，窄屏改成三行；搏斗圆盘跟着容器缩，不再固定 178px 顶出去。
 */
export const CSS_FISHING = `
.dp-fish-bobber-img{display:block;width:38px;height:52px;object-fit:contain}
[data-art-loaded=true]>.dp-fish-art-fallback,[data-art-loaded=true]>.dp-fish-fight-fallback,[data-art-loaded=true]>.dp-fish-result-emoji{visibility:hidden}
.dp-fish{container-type:inline-size;container-name:fishing;display:flex;flex-direction:column;gap:8px;min-width:0}
.dp-fish-hero{display:grid;gap:4px;padding:6px 8px 7px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content)}
.dp-fish-hero-cap{display:flex;flex-direction:column;align-items:center;gap:1px;line-height:1.2}
.dp-fish-kicker{font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--ac-text-2)}
.dp-fish-spot-name{font-size:19px;font-weight:800;letter-spacing:.04em;color:var(--ac-text)}
.dp-fish-tag{font-size:9.5px;font-weight:700;color:#9a6b1f}
.dp-fish-art{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:13px;background:linear-gradient(160deg,#dff8f3,#bfeef0)}
.dp-fish-art-fallback{font-size:34px;line-height:1;filter:drop-shadow(0 2px 0 rgba(61,52,40,.14))}
.dp-fish-art-img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
[data-dsh-pig] .dp-fish-art-img[hidden],[data-dsh-pig] .dp-fish-result-img[hidden],[data-dsh-pig] .dp-fish-fight-img[hidden]{display:none}
.dp-fish-hero-art{height:60px}
.dp-fish-panel{padding:6px 9px 7px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content)}
.dp-fish-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin:0 1px 5px;font-size:12px;color:var(--ac-text)}
.dp-fish-head b{font-weight:800}
.dp-fish-head-note{max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;color:var(--ac-text-2)}
.dp-fish-baits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.dp-fish-bait{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;gap:3px;min-width:0;padding:6px 4px;border:2px solid var(--ac-border-light);border-radius:14px;background:var(--ac-bg-input);color:var(--ac-text-body);font:inherit;cursor:pointer;transition:border-color .15s var(--ac-ease),background .15s var(--ac-ease)}
.dp-fish-bait em{font-style:normal;font-size:24px;line-height:1.1}
.dp-fish-bait-text{display:flex;align-items:baseline;justify-content:center;gap:4px;min-width:0;max-width:100%}
.dp-fish-bait b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:700;color:var(--ac-text)}
.dp-fish-bait small{white-space:nowrap;font-size:10px;font-weight:700;color:var(--ac-text-2)}
.dp-fish-bait[aria-pressed=true]{border-color:var(--ac-primary);background:var(--ac-primary-bg);box-shadow:inset 0 0 0 1px var(--ac-primary)}
.dp-fish-bait:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}
.dp-fish-bait:disabled{opacity:.55;background:var(--ac-bg-disabled);cursor:not-allowed}
.dp-fish-blocked{margin:0;padding:8px 10px;border-radius:12px;background:#fff1df;color:#8f5123;font-size:11px;font-weight:700;line-height:1.5}
.dp-fish-care{align-self:flex-start;margin:0}
.dp-fish-cast,.dp-fish-keep{display:block;width:100%;min-height:46px;border:2px solid var(--ac-primary-active);border-radius:var(--ac-pill);background:var(--ac-primary);color:#fff;font:inherit;font-size:15px;font-weight:800;letter-spacing:.08em;box-shadow:0 4px 0 var(--ac-primary-active);cursor:pointer;touch-action:manipulation;transition:transform .15s var(--ac-ease),box-shadow .15s var(--ac-ease),background .15s var(--ac-ease)}
.dp-fish-cast:hover:not(:disabled),.dp-fish-keep:hover:not(:disabled){background:var(--ac-primary-hover);transform:translateY(-1px);box-shadow:0 5px 0 var(--ac-primary-active)}
.dp-fish-cast:active:not(:disabled),.dp-fish-keep:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 var(--ac-primary-active)}
.dp-fish-cast:disabled{background:var(--ac-bg-disabled);color:var(--ac-text-disabled);border-color:var(--ac-border-light);box-shadow:none;cursor:not-allowed}
.dp-fish-sec{overflow:hidden;border:2px solid var(--ac-border-light);border-radius:16px;background:var(--ac-bg-content)}
.dp-fish-summary{display:flex;align-items:center;gap:6px;min-height:32px;padding:5px 10px;list-style:none;color:var(--ac-text);font-size:11px;font-weight:800;cursor:pointer}
.dp-fish-summary::-webkit-details-marker{display:none}
.dp-fish-summary:focus-visible{outline:2px solid var(--ac-primary);outline-offset:-2px}
.dp-fish-summary-main{display:flex;align-items:center;gap:6px;min-width:0}
.dp-fish-summary-value{margin-left:auto;max-width:45%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;font-weight:700;color:var(--ac-text-2)}
.dp-fish-chev{flex:none;font-size:13px;line-height:1;color:var(--ac-text-2);transition:transform .2s var(--ac-ease)}
.dp-fish-sec[open] .dp-fish-chev{transform:rotate(180deg)}
.dp-fish-sec-body{display:grid;gap:7px;padding:0 9px 9px}
.dp-fish-spots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.dp-fish-spot{display:grid;justify-items:center;gap:1px;min-width:0;padding:6px 2px;border:2px solid var(--ac-border-light);border-radius:14px;background:var(--ac-bg-input);color:var(--ac-text-body);font:inherit;cursor:pointer}
.dp-fish-spot em{font-style:normal;font-size:20px;line-height:1.1}
.dp-fish-spot b{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;font-weight:700;color:var(--ac-text)}
.dp-fish-spot small{font-size:9.5px;font-weight:600;color:var(--ac-text-2);white-space:nowrap}
.dp-fish-spot[aria-pressed=true]{background:var(--ac-primary-bg);border-color:var(--ac-primary);box-shadow:0 2px 0 var(--ac-primary)}
.dp-fish-spot:disabled{opacity:.55;cursor:not-allowed}
.dp-fish-spot:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}
.dp-fish-rodnow{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:10px;background:var(--ac-bg-input);font-size:11px;font-weight:800;color:var(--ac-text)}
.dp-fish-rodnow small{font-size:10px;font-weight:600;color:var(--ac-text-2)}
.dp-fish-note{margin:0;font-size:10px;line-height:1.5;font-weight:600;color:var(--ac-text-2)}
.dp-fish-stock{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;font-weight:700;color:var(--ac-text-body)}
.dp-fish-stock .dp-mini{margin-left:auto}
.dp-fish-auto-bait{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:10px;background:var(--ac-bg-input);font-size:10.5px;font-weight:700;color:var(--ac-text-body)}
.dp-fish-auto-bait b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ac-text)}
.dp-fish-auto-row{display:grid;gap:6px}
.dp-fish-auto-go{width:100%;padding:7px 10px;font-size:11px}
.dp-fish-auto .dp-mini[data-fish-upgrade]{width:100%;font-size:10.5px}
.dp-fish-why{font-size:10px;font-weight:700;line-height:1.45;color:var(--ac-error)}
.dp-fish-context{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 10px;border:2px solid var(--ac-border-light);border-radius:11px;background:var(--ac-bg-content);color:var(--ac-text-body);font-size:10.5px;font-weight:700;text-align:center}
.dp-fish-water{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:230px;padding:0;overflow:hidden;border:2px solid var(--ac-border-light);border-radius:18px;background:linear-gradient(#d8f7ff 0 34%,#62c9e8 35% 70%,#2f9cc4 71%);cursor:pointer;touch-action:manipulation}
.dp-fish-water-art{position:absolute;inset:0;width:auto;height:auto;border-radius:0}
.dp-fish-water-art .dp-fish-art-fallback{font-size:46px;opacity:.9}
.dp-fish-bobber{position:relative;z-index:2;font-size:44px;line-height:1;filter:drop-shadow(0 3px 0 rgba(61,52,40,.25));animation:dp-fish-bob 1.3s ease-in-out infinite}
.dp-fish-waiting[data-bite=true]{box-shadow:inset 0 0 0 4px var(--ac-warning)}
.dp-fish-waiting[data-bite=true] .dp-fish-bobber{animation:dp-fish-bite .18s ease-in-out infinite alternate}
.dp-fish-waiting[data-nibble=true] .dp-fish-bobber{animation:dp-fish-nibble .42s ease-in-out}
.dp-fish-wait-state{display:grid;justify-items:center;gap:2px;text-align:center}
.dp-fish-wait-state b{font-size:14px;font-weight:800;color:var(--ac-text)}
.dp-fish-wait-state small{font-size:10px;font-weight:600;color:var(--ac-text-2)}
@keyframes dp-fish-bob{50%{transform:translateY(5px)}}
@keyframes dp-fish-bite{to{transform:scale(1.2) rotate(7deg)}}
@keyframes dp-fish-nibble{0%,100%{transform:translateY(0)}30%{transform:translateY(5px) rotate(-6deg)}60%{transform:translateY(-2px) rotate(4deg)}}
.dp-fish-fight-art{position:relative;display:flex;align-items:center;justify-content:center;height:82px;overflow:hidden;border:2px solid var(--ac-border-light);border-radius:16px;background:var(--ac-bg-content)}
.dp-fish-fight-fallback{font-size:28px;line-height:1;filter:drop-shadow(0 2px 0 rgba(61,52,40,.14))}
.dp-fish-fight-img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain}
.dp-fish-qte{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;min-height:0;padding:12px 10px 10px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content);color:var(--ac-text);box-sizing:border-box;cursor:pointer;touch-action:manipulation;outline:0}
.dp-fish-qte:focus-visible{box-shadow:0 0 0 3px var(--ac-primary)}
.dp-fish-qte-title{font-size:14px;font-weight:800;color:var(--ac-text)}
.dp-fish-qte-ring{position:relative;flex:none;width:178px;width:clamp(118px,calc(100cqw - 84px),178px);aspect-ratio:1;border-radius:50%;box-shadow:0 3px 12px #246a7a44,inset 0 0 0 2px #fff;transform:rotate(-90deg)}
.dp-fish-qte-ring:after{content:"";position:absolute;inset:17%;border-radius:50%;background:#f8feff;box-shadow:inset 0 2px 8px #8ab7c044}
.dp-fish-qte-needle{position:absolute;z-index:3;left:50%;bottom:50%;width:4px;height:47%;border-radius:4px;background:#ed5d55;box-shadow:0 0 0 1px #fff,0 0 6px #d64a45;transform-origin:50% 100%}
.dp-fish-qte-needle:after{content:"";position:absolute;top:-5px;left:-3px;width:10px;height:10px;border-radius:50%;background:#ed5d55}
.dp-fish-qte-core{position:absolute;z-index:4;inset:19%;display:flex;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle,#fff 0 48%,#e9f9fb 70%);font-size:42px;font-size:clamp(24px,15cqw,42px);transform:rotate(90deg)}
.dp-fish-qte-score{font-size:13px;font-weight:700;color:var(--ac-text)}
.dp-fish-qte-feedback{min-height:17px;font-size:11px;font-weight:600;color:var(--ac-text-2);text-align:center}
.dp-fish-qte[data-qte-feedback^="还没到"] .dp-fish-qte-feedback,.dp-fish-qte[data-qte-feedback^="已经划过"] .dp-fish-qte-feedback{color:var(--ac-error);font-weight:700}
.dp-fish-help{text-align:center;font-size:10px;font-weight:600;line-height:1.45;color:var(--ac-text-2)}
.dp-fish-stage{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;padding:12px 10px 10px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content);color:var(--ac-text);box-sizing:border-box;cursor:pointer;touch-action:none;user-select:none;outline:0}
.dp-fish-stage:focus-visible{box-shadow:0 0 0 3px var(--ac-primary)}
.dp-fish-bar{display:grid;grid-template-columns:56px 14px;gap:10px;height:220px}
.dp-fish-track{position:relative;overflow:hidden;border-radius:14px;background:linear-gradient(#bfe6ef,#8fd0df)}
.dp-fish-zone{position:absolute;left:3px;right:3px;border:2px solid #4cb860;border-radius:10px;background:#6bd47bbb;box-sizing:border-box}
.dp-fish-swimmer{position:absolute;left:50%;font-size:24px;line-height:1;transform:translate(-50%,50%)}
.dp-fish-vmeter{position:relative;overflow:hidden;border-radius:10px;background:#dce8e9}
.dp-fish-vmeter i{position:absolute;left:0;right:0;bottom:0;background:var(--ac-warning)}
.dp-fish-stage[data-inside=true] .dp-fish-vmeter i{background:#6bd47b}
.dp-fish-line{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;font-weight:700;color:#4a7a86}
.dp-fish-rod{font-size:36px;transition:transform .1s}
.dp-fish-gauge{position:relative;width:100%;height:24px;border-radius:50px;background:linear-gradient(90deg,#bfe6ef 0 30%,#6bd47b 30% 72%,#ffd45d 72% 85%,#e05a5a 85%)}
.dp-fish-gauge b{position:absolute;top:-6px;width:6px;height:36px;border-radius:4px;background:var(--ac-text);transform:translateX(-50%)}
.dp-fish-pull-state{min-height:16px;font-size:12px;font-weight:800;color:var(--ac-text)}
.dp-fish-hmeter{width:100%;height:10px;overflow:hidden;border-radius:50px;background:#dce8e9}
.dp-fish-hmeter i{display:block;height:100%;width:0;background:#6bd47b}
.dp-fish-result{display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 12px 10px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content);text-align:center}
.dp-fish-result-art{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:124px;overflow:hidden;border-radius:14px;background:radial-gradient(circle at 50% 45%,#fff8cf 0,#fdf3d3 38%,#f8f2df 70%)}
.dp-fish-result-emoji{font-size:64px;line-height:1;filter:drop-shadow(0 3px 0 rgba(61,52,40,.16))}
.dp-fish-result-img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;box-sizing:border-box;padding:4px}
.dp-fish-result-title{font-size:15px;font-weight:800;color:var(--ac-text)}
.dp-fish-stars{font-size:17px;letter-spacing:3px;color:#e8b400}
.dp-fish-facts{font-size:12px;font-weight:700;color:var(--ac-text-body)}
.dp-fish-away{display:flex;align-items:center;justify-content:center;padding:18px 0 8px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content);font-size:58px;line-height:1}
@container fishing (max-width:235px){.dp-fish-hero-art{height:60px}.dp-fish-baits{grid-template-columns:minmax(0,1fr);gap:6px}.dp-fish-bait{grid-template-columns:auto minmax(0,1fr);justify-items:start;align-items:center;gap:8px;padding:7px 10px}.dp-fish-bait em{font-size:24px}.dp-fish-bait-text{justify-content:flex-start}.dp-fish-spots{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-fish-fight-art{height:68px}.dp-fish-spot-name{font-size:17px}.dp-fish-cast,.dp-fish-keep{min-height:42px;font-size:14px}}
@media (prefers-reduced-motion:reduce){.dp-fish-bobber,.dp-fish-waiting[data-bite=true] .dp-fish-bobber,.dp-fish-waiting[data-nibble=true] .dp-fish-bobber{animation:none!important}.dp-fish-chev,.dp-fish-cast,.dp-fish-keep,.dp-fish-bait{transition:none!important}}
`
