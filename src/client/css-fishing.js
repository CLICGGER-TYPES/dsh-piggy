// @ts-check
/**
 * 钓鱼页样式（2026-11-06 重做）：钓点场景、独立鱼饵卡、底部三个入口。
 * 奶油底、棕色字、米色细边、青色主按钮；窄面板用容器查询缩场景和鱼饵。
 */
export const CSS_FISHING = `
.dp-fish-bobber-img{display:block;width:38px;height:52px;object-fit:contain}
[data-art-loaded=true]>.dp-fish-art-fallback,[data-art-loaded=true]>.dp-fish-fight-fallback,[data-art-loaded=true]>.dp-fish-result-emoji{visibility:hidden}
.dp-fish{container-type:inline-size;container-name:fishing;display:flex;flex-direction:column;gap:0;min-width:0}
.dp-fish-scene{position:relative;height:226px;overflow:hidden;border:2px solid var(--ac-border-light);border-radius:20px;background:linear-gradient(160deg,#e4f2e2,#c9e8df)}
.dp-fish-art{position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:13px;background:linear-gradient(160deg,#dff8f3,#bfeef0)}
.dp-fish-art-fallback{font-size:34px;line-height:1;filter:drop-shadow(0 2px 0 rgba(61,52,40,.14))}
.dp-fish-art-img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover}
[data-dsh-pig] .dp-fish-art-img[hidden],[data-dsh-pig] .dp-fish-result-img[hidden],[data-dsh-pig] .dp-fish-fight-img[hidden]{display:none}
.dp-fish-hero-art{height:100%;border-radius:0}
.dp-fish-scene-art{width:100%;height:100%;border-radius:0}
.dp-fish-scene-top{position:absolute;z-index:3;top:8px;left:8px;right:8px;display:flex;align-items:flex-start;justify-content:space-between;pointer-events:none}
.dp-fish-loc-pill{display:inline-flex;align-items:center;gap:3px;padding:4px 9px;border-radius:999px;background:rgba(255,250,240,.94);box-shadow:0 1px 3px rgba(61,52,40,.12);color:var(--ac-text);font-size:11px;font-weight:800;line-height:1.2}
.dp-fish-loc-icon{font-size:10px;line-height:1}
.dp-fish-scene-bottom{position:absolute;z-index:3;right:9px;bottom:8px;display:flex;align-items:center;justify-content:flex-end;gap:4px;flex-wrap:wrap}
.dp-fish-scene-pill{padding:3px 8px;border-radius:999px;background:rgba(255,250,240,.94);box-shadow:0 1px 3px rgba(61,52,40,.12);color:#5e6f4f;font-size:9px;font-weight:800;line-height:1.4}
.dp-fish-scene-warn{background:#ffe4b8;color:#8f5123}
.dp-fish-mascot{position:absolute;z-index:2;left:25%;top:20.5%;width:27.7%;aspect-ratio:222/130;overflow:hidden;pointer-events:none;transform:scaleX(-1);filter:drop-shadow(0 2px 2px rgba(61,52,40,.18))}
.dp-fish-mascot-img{display:block;width:100%;height:100%}

.dp-fish-dock{position:relative;z-index:2;margin:6px 0 0;padding:6px 9px 7px;border:2px solid var(--ac-border-light);border-radius:20px;background:var(--ac-bg-content)}
.dp-fish-dock-head{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:0 1px 3px;min-height:12px;font-size:9.5px;color:var(--ac-text)}
.dp-fish-dock-head b{font-weight:800}
.dp-fish-dock-note{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.5px;font-weight:700;color:var(--ac-text-2)}
.dp-fish-dock-shop{flex:none;padding:1px 7px;border:0;border-radius:999px;background:var(--ac-primary-bg);color:var(--ac-primary-active);font:inherit;font-size:8.5px;font-weight:800;cursor:pointer}
.dp-fish-warn{display:flex;align-items:center;justify-content:space-between;gap:6px;margin:0 0 7px;padding:5px 8px;border-radius:11px;background:#fff1df;color:#8f5123;font-size:10px;font-weight:700;line-height:1.35}
.dp-fish-warn .dp-mini{flex:none;margin:0;padding:3px 8px;font-size:9.5px}
.dp-fish-baits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));justify-items:center;gap:8px}
.dp-fish-bait{position:relative;display:grid;place-items:center;width:48px;max-width:100%;aspect-ratio:1;padding:0;border:2px solid #f0d6c4;border-radius:50%;background:#fff7ef;color:var(--ac-text);font:inherit;cursor:pointer;transition:border-color .15s var(--ac-ease),background .15s var(--ac-ease),transform .15s var(--ac-ease)}
.dp-fish-bait em{font-style:normal;font-size:21px;line-height:1;transform:translateY(-1px)}
.dp-fish-bait[aria-pressed=true]{border-color:var(--ac-primary);background:var(--ac-primary-bg);box-shadow:inset 0 0 0 2px var(--ac-primary)}
.dp-fish-bait:hover:not(:disabled){transform:translateY(-1px)}
.dp-fish-bait:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px}
.dp-fish-bait:disabled{opacity:.45;filter:grayscale(.4);cursor:not-allowed}
.dp-fish-bait-count{position:absolute;right:-2px;bottom:-2px;min-width:16px;height:16px;padding:0 3px;border:1.5px solid var(--ac-border-light);border-radius:999px;background:var(--ac-bg-content);color:var(--ac-text-body);font-size:8px;font-weight:800;line-height:13px;text-align:center}
.dp-fish-bait[aria-pressed=true] .dp-fish-bait-count{border-color:var(--ac-primary);background:var(--ac-primary);color:#fff}
.dp-fish-bait-check{position:absolute;top:-2px;right:-2px;display:grid;place-items:center;width:14px;height:14px;border-radius:50%;background:var(--ac-primary);color:#fff;font-size:8px;font-weight:900;line-height:1;box-shadow:0 0 0 2px var(--ac-bg-content)}
.dp-fish-cast,.dp-fish-keep{display:block;min-height:46px;border:2px solid var(--ac-primary-active);border-radius:var(--ac-pill);background:var(--ac-primary);color:#fff;font:inherit;font-size:15px;font-weight:800;letter-spacing:.08em;box-shadow:0 4px 0 var(--ac-primary-active);cursor:pointer;touch-action:manipulation;transition:transform .15s var(--ac-ease),box-shadow .15s var(--ac-ease),background .15s var(--ac-ease)}
.dp-fish-cast{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:4px;width:max-content;min-width:116px;min-height:32px;margin:6px auto 0;padding:0 18px;font-size:12.5px;letter-spacing:.06em}
.dp-fish-keep{width:100%}
.dp-fish-cast:hover:not(:disabled),.dp-fish-keep:hover:not(:disabled){background:var(--ac-primary-hover);transform:translateY(-1px);box-shadow:0 5px 0 var(--ac-primary-active)}
.dp-fish-cast:active:not(:disabled),.dp-fish-keep:active:not(:disabled){transform:translateY(2px);box-shadow:0 1px 0 var(--ac-primary-active)}
.dp-fish-cast:disabled{background:var(--ac-bg-disabled);color:var(--ac-text-disabled);border-color:var(--ac-border-light);box-shadow:none;cursor:not-allowed}
.dp-fish-gear{display:flex;align-items:center;justify-content:center;gap:8px;margin:6px 0 0}
.dp-fish-gear-btn{display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:0 10px;border:2px solid var(--ac-border-light);border-radius:999px;background:var(--ac-bg-content);color:var(--ac-text-body);font:inherit;font-size:9.5px;font-weight:700;line-height:1;cursor:pointer;transition:border-color .15s var(--ac-ease),background .15s var(--ac-ease),box-shadow .15s var(--ac-ease)}
.dp-fish-gear-icon{display:inline-block;font-size:13px;line-height:1}
.dp-fish-gear-value{white-space:nowrap}
.dp-fish-gear-btn[aria-pressed=true]{background:var(--ac-primary-bg);border-color:var(--ac-primary);color:var(--ac-text);box-shadow:0 2px 0 var(--ac-primary)}
.dp-fish-gear-btn:hover{border-color:var(--ac-border-hover)}
.dp-fish-gear-btn:focus-visible{outline:2px solid var(--ac-primary);outline-offset:2px}
.dp-fish-gear-panel{margin:8px 0 0;padding:9px 10px 10px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content);animation:dp-fish-rise .18s var(--ac-ease)}
@keyframes dp-fish-rise{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.dp-fish-gear-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 1px 7px}
.dp-fish-gear-head b{font-size:11.5px;font-weight:800;color:var(--ac-text)}
.dp-fish-gear-close{padding:1px 2px;border:0;background:none;color:var(--ac-text-2);font:inherit;font-size:9.5px;font-weight:700;cursor:pointer}
.dp-fish-gear-close:hover{color:var(--ac-text)}
.dp-fish-spots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.dp-fish-spot{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:7px;min-width:0;padding:7px 8px;border:2px solid var(--ac-border-light);border-radius:14px;background:var(--ac-bg-input);color:var(--ac-text-body);font:inherit;text-align:left;cursor:pointer;transition:border-color .15s var(--ac-ease),background .15s var(--ac-ease)}
.dp-fish-spot em{font-style:normal;font-size:20px;line-height:1}
.dp-fish-spot-text{display:grid;gap:1px;min-width:0}
.dp-fish-spot b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:800;color:var(--ac-text)}
.dp-fish-spot small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8.5px;font-weight:600;color:var(--ac-text-2)}
.dp-fish-spot[aria-pressed=true]{background:var(--ac-primary-bg);border-color:var(--ac-primary);box-shadow:0 2px 0 var(--ac-primary)}
.dp-fish-spot:disabled{opacity:.55;cursor:not-allowed}
.dp-fish-spot:focus-visible{outline:2px solid var(--ac-primary);outline-offset:1px}
.dp-fish-rod-panel{display:grid;gap:7px}
.dp-fish-rod-panel .dp-mini{width:100%}
.dp-fish-rodnow{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:10px;background:var(--ac-bg-input);font-size:11px;font-weight:800;color:var(--ac-text)}
.dp-fish-rodnow small{font-size:10px;font-weight:600;color:var(--ac-text-2)}
.dp-fish-note{margin:0;font-size:10px;line-height:1.5;font-weight:600;color:var(--ac-text-2)}
.dp-fish-auto{display:grid;gap:7px}
.dp-fish-auto-bait{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;border-radius:10px;background:var(--ac-bg-input);font-size:10.5px;font-weight:700;color:var(--ac-text-body)}
.dp-fish-auto-bait b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ac-text)}
.dp-fish-stock{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:10.5px;font-weight:700;color:var(--ac-text-body)}
.dp-fish-stock .dp-mini{margin-left:auto}
.dp-fish-auto-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.dp-fish-auto-go{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:100%;min-height:38px;padding:5px 4px;line-height:1.2}
.dp-fish-auto-go b{font-size:11px;font-weight:800}
.dp-fish-auto-go small{font-size:8.5px;font-weight:700;color:var(--ac-text-2);white-space:nowrap}
.dp-fish-auto-go:disabled small{color:var(--ac-text-disabled)}
.dp-fish-auto-head{margin-top:1px;font-size:9px;font-weight:800;letter-spacing:.08em;color:var(--ac-text-2)}
.dp-fish-buy{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-height:32px;padding:5px 9px;border:2px solid var(--ac-border-light);border-radius:12px;background:var(--ac-bg-input);color:var(--ac-text);font:inherit;font-size:10px;font-weight:700;text-align:left;cursor:pointer}
.dp-fish-buy b{flex:none;font-size:9.5px;font-weight:800;color:var(--ac-text-body)}
.dp-fish-buy:disabled{opacity:.55;cursor:not-allowed}
.dp-fish-why{font-size:10px;font-weight:700;line-height:1.45;color:var(--ac-error)}
.dp-fish-panel{padding:8px 10px 9px;border:2px solid var(--ac-border-light);border-radius:16px;background:var(--ac-bg-content)}
.dp-fish-head{display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin:0 1px 5px;font-size:12px;color:var(--ac-text)}
.dp-fish-head b{font-weight:800}
.dp-fish-context{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:6px 10px;border:2px solid var(--ac-border-light);border-radius:11px;background:var(--ac-bg-content);color:var(--ac-text-body);font-size:10.5px;font-weight:700;text-align:center;margin-bottom:8px}
.dp-fish-water{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:230px;padding:0;overflow:hidden;border:2px solid var(--ac-border-light);border-radius:18px;background:linear-gradient(#d8f7ff 0 34%,#62c9e8 35% 70%,#2f9cc4 71%);cursor:pointer;touch-action:manipulation}
.dp-fish-water-art{position:absolute;inset:0;width:auto;height:auto;border-radius:0}
.dp-fish-water-art .dp-fish-art-fallback{font-size:46px;opacity:.9}
.dp-fish-bobber{position:relative;z-index:2;font-size:44px;line-height:1;filter:drop-shadow(0 3px 0 rgba(61,52,40,.25));animation:dp-fish-bob 1.3s ease-in-out infinite}
.dp-fish-waiting[data-bite=true]{box-shadow:inset 0 0 0 4px var(--ac-warning)}
.dp-fish-waiting[data-bite=true] .dp-fish-bobber{animation:dp-fish-bite .18s ease-in-out infinite alternate}
.dp-fish-waiting[data-nibble=true] .dp-fish-bobber{animation:dp-fish-nibble .42s ease-in-out}
.dp-fish-wait-state{display:grid;justify-items:center;gap:2px;margin-top:8px;text-align:center}
.dp-fish-wait-state b{font-size:14px;font-weight:800;color:var(--ac-text)}
.dp-fish-wait-state small{font-size:10px;font-weight:600;color:var(--ac-text-2)}
@keyframes dp-fish-bob{50%{transform:translateY(5px)}}
@keyframes dp-fish-bite{to{transform:scale(1.2) rotate(7deg)}}
@keyframes dp-fish-nibble{0%,100%{transform:translateY(0)}30%{transform:translateY(5px) rotate(-6deg)}60%{transform:translateY(-2px) rotate(4deg)}}
.dp-fish-fight-art{position:relative;display:flex;align-items:center;justify-content:center;height:82px;margin-bottom:8px;overflow:hidden;border:2px solid var(--ac-border-light);border-radius:16px;background:var(--ac-bg-content)}
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
.dp-fish-away{display:flex;align-items:center;justify-content:center;padding:18px 0 8px;border:2px solid var(--ac-border-light);border-radius:18px;background:var(--ac-bg-content);font-size:58px;line-height:1;margin-bottom:8px}
@container fishing (max-width:235px){.dp-fish-gear{gap:6px}.dp-fish-scene{height:200px}.dp-fish-bait{width:44px}.dp-fish-bait em{font-size:20px}.dp-fish-gear-btn{min-height:26px;padding:0 8px;font-size:9px}.dp-fish-gear-icon{font-size:12px}.dp-fish-spots{grid-template-columns:minmax(0,1fr)}.dp-fish-cast{min-height:30px;min-width:104px;padding:0 14px;font-size:12px}.dp-fish-keep{min-height:34px;font-size:13px}}
@media (prefers-reduced-motion:reduce){.dp-fish-bobber,.dp-fish-waiting[data-bite=true] .dp-fish-bobber,.dp-fish-waiting[data-nibble=true] .dp-fish-bobber,.dp-fish-gear-panel{animation:none!important}.dp-fish-chev,.dp-fish-cast,.dp-fish-keep,.dp-fish-bait,.dp-fish-gear-btn{transition:none!important}}
`
