// @ts-check
export const CSS_FISHING = `
.dp-fish-blocked{margin:10px 0 6px;padding:9px 11px;border-radius:10px;background:#fff1df;color:#8f5123;font-size:12px;font-weight:700}.dp-fish-care{margin-bottom:8px}.dp-fish-cast{display:block;width:100%;min-height:44px;margin-top:12px;touch-action:manipulation}
.dp-fish-scene{margin:8px 0;padding:20px 8px;border-radius:16px;background:linear-gradient(#c8f2ff 0 45%,#69c9e8 46%);text-align:center;font-size:24px;letter-spacing:4px}.dp-fish-copy{font-size:12px;line-height:1.55;color:#61727a;margin:8px 2px}.dp-fish-cast{touch-action:manipulation}.dp-fish-waiting{width:100%;height:245px;border:0;border-radius:18px;background:linear-gradient(#d7f6ff 0 34%,#5cc7e8 35% 72%,#2d9ac3 73%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#16495b;cursor:pointer}.dp-fish-bobber{font-size:42px;animation:dp-fish-bob 1.3s ease-in-out infinite}.dp-fish-waiting[data-bite=true]{box-shadow:0 0 0 4px #ffcf45 inset}.dp-fish-waiting[data-bite=true] .dp-fish-bobber{animation:dp-fish-bite .18s ease-in-out infinite alternate}@keyframes dp-fish-bob{50%{transform:translateY(5px)}}@keyframes dp-fish-bite{to{transform:scale(1.2) rotate(7deg)}}
.dp-fish-qte{width:100%;min-height:318px;border:0;border-radius:18px;padding:15px 12px 12px;box-sizing:border-box;background:linear-gradient(155deg,#eefcff,#d8f3f8);display:flex;flex-direction:column;align-items:center;gap:9px;color:#294950;cursor:pointer;touch-action:manipulation;outline:0}.dp-fish-qte:focus-visible{box-shadow:0 0 0 3px #43b96f}.dp-fish-qte-title{font-size:15px;font-weight:800}.dp-fish-qte-ring{position:relative;width:178px;height:178px;border-radius:50%;box-shadow:0 3px 12px #246a7a44,inset 0 0 0 2px #fff;transform:rotate(-90deg)}.dp-fish-qte-ring:after{content:"";position:absolute;inset:17px;border-radius:50%;background:#f8feff;box-shadow:inset 0 2px 8px #8ab7c044}.dp-fish-qte-needle{position:absolute;z-index:3;left:50%;bottom:50%;width:4px;height:47%;border-radius:4px;background:#ed5d55;box-shadow:0 0 0 1px #fff,0 0 6px #d64a45;transform-origin:50% 100%}.dp-fish-qte-needle:after{content:"";position:absolute;top:-5px;left:-3px;width:10px;height:10px;border-radius:50%;background:#ed5d55}.dp-fish-qte-core{position:absolute;z-index:4;inset:31px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,#fff 0 48%,#e9f9fb 70%);font-size:42px;transform:rotate(90deg)}.dp-fish-qte-score{font-size:14px}.dp-fish-qte-feedback{min-height:18px;font-size:12px;color:#55727a}.dp-fish-qte[data-qte-feedback^="还没到"] .dp-fish-qte-feedback,.dp-fish-qte[data-qte-feedback^="已经划过"] .dp-fish-qte-feedback{color:#bd5545;font-weight:700}.dp-fish-help{text-align:center;font-size:11px;color:#718188}.dp-fish-result,.dp-fish-away{display:flex;flex-direction:column;align-items:center;gap:10px;margin:16px 0;padding:22px 14px;border-radius:18px;background:#edfaff;text-align:center}.dp-fish-result-emoji,.dp-fish-away{font-size:58px}.dp-fish-result span{color:#65757b;font-size:13px}
.dp-fish-label{margin:4px 2px 6px;font-size:11px;font-weight:800;color:var(--ac-text-2);letter-spacing:.04em}
.dp-fish-baits{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.dp-fish-bait{font:inherit;display:grid;justify-items:center;gap:2px;padding:8px 4px;border-radius:14px;border:2px solid var(--ac-border-light);background:var(--ac-bg-input);color:var(--ac-text-body);cursor:pointer}
.dp-fish-bait em{font-style:normal;font-size:22px;line-height:1.2}.dp-fish-bait b{font-size:11px;color:var(--ac-text)}.dp-fish-bait small{font-size:9.5px;color:var(--ac-text-2)}
.dp-fish-bait[aria-pressed=true]{border-color:var(--ac-primary);background:var(--ac-primary-bg)}.dp-fish-bait:disabled{opacity:.5;cursor:not-allowed}
.dp-fish-auto{display:grid;gap:6px;margin-top:12px;padding-top:9px;border-top:1.5px dashed var(--ac-border-light);font-size:11px;color:var(--ac-text-body)}
.dp-fish-auto summary{cursor:pointer;font-weight:800;color:var(--ac-text)}.dp-fish-auto-row{display:flex;flex-wrap:wrap;gap:6px}.dp-fish-why{color:var(--ac-text-2)}
.dp-fish-stars{color:#e8b400;letter-spacing:2px;font-size:14px!important}
.dp-fish-stage{width:100%;border:0;border-radius:18px;padding:14px 12px 12px;box-sizing:border-box;background:linear-gradient(155deg,#eefcff,#d8f3f8);display:flex;flex-direction:column;align-items:center;gap:10px;color:#294950;cursor:pointer;touch-action:none;user-select:none;outline:0}
.dp-fish-stage:focus-visible{box-shadow:0 0 0 3px #43b96f}
.dp-fish-bar{display:grid;grid-template-columns:56px 14px;gap:10px;height:220px}
.dp-fish-track{position:relative;border-radius:14px;background:linear-gradient(#bfe6ef,#8fd0df);overflow:hidden}
.dp-fish-zone{position:absolute;left:3px;right:3px;border-radius:10px;background:#6bd47bbb;border:2px solid #4cb860;box-sizing:border-box}
.dp-fish-swimmer{position:absolute;left:50%;font-size:24px;line-height:1;transform:translate(-50%,50%)}
.dp-fish-vmeter{position:relative;border-radius:10px;background:#dce8e9;overflow:hidden}.dp-fish-vmeter i{position:absolute;left:0;right:0;bottom:0;background:#ffd45d}
.dp-fish-stage[data-inside=true] .dp-fish-vmeter i{background:#6bd47b}
.dp-fish-line{display:flex;align-items:center;justify-content:center;gap:6px;font-size:13px;color:#4a7a86}.dp-fish-rod{font-size:36px;transition:transform .1s}
.dp-fish-gauge{position:relative;width:100%;height:24px;border-radius:50px;background:linear-gradient(90deg,#bfe6ef 0 30%,#6bd47b 30% 72%,#ffd45d 72% 85%,#e05a5a 85%)}
.dp-fish-gauge b{position:absolute;top:-6px;width:6px;height:36px;border-radius:4px;background:#794f27;transform:translateX(-50%)}
.dp-fish-pull-state{font-size:12px;font-weight:800;min-height:16px}
.dp-fish-hmeter{width:100%;height:10px;border-radius:50px;background:#dce8e9;overflow:hidden}.dp-fish-hmeter i{display:block;height:100%;width:0;background:#6bd47b}
.dp-fish-spots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 8px}
.dp-fish-spot{display:grid;justify-items:center;gap:1px;padding:6px 2px;border-radius:14px;font:inherit;color:inherit;cursor:pointer;background:var(--ac-bg-content);border:2px solid var(--ac-border-light)}
.dp-fish-spot em{font-style:normal;font-size:20px;line-height:1.1}.dp-fish-spot b{font-size:10.5px}.dp-fish-spot small{font-size:9.5px;color:var(--ac-text-2)}
.dp-fish-spot[aria-pressed="true"]{background:#e3f4f6;border-color:#7cc7d1;box-shadow:0 2px 0 #7cc7d1}.dp-fish-spot:disabled{opacity:.55;cursor:default}
.dp-fish-rodrow{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0 0 10px;font-size:11px;font-weight:800}
.dp-fish-rodrow small{width:100%;font-weight:600;font-size:10px;color:var(--ac-text-2)}
.dp-fish-waiting[data-nibble="true"] .dp-fish-bobber{animation:dp-fish-nibble .42s ease-in-out}
@keyframes dp-fish-nibble{0%,100%{transform:translateY(0)}30%{transform:translateY(5px) rotate(-6deg)}60%{transform:translateY(-2px) rotate(4deg)}}
`
