// @ts-check
export const CSS_ACHIEVEMENTS = `
.dp-ach-controls{margin-bottom:8px}
.dp-ach-controls .dp-ach-options{display:flex}
.dp-ach-count{font-size:11px;color:var(--ac-text-muted);margin:8px 0 12px}
.dp-ach-intro{font-size:12px;line-height:1.7;color:var(--ac-ink-soft,#756c60);padding:3px 0 12px}
.dp-ach-group{font-size:12px;font-weight:800;margin:16px 0 8px;color:var(--ac-ink,#514341)}
.dp-ach-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dp-ach-card{border:1px solid #e8e2d5;background:#fffdf7;border-radius:18px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;color:#514341;cursor:pointer;font:inherit}
.dp-ach-card b{font-size:12px}.dp-ach-card small{font-size:11px;color:#81786d}
.dp-ach-badge{width:74px;height:74px;object-fit:contain;pointer-events:none}
[data-earned="false"]>.dp-ach-badge{filter:grayscale(1);opacity:.48}
.dp-ach-card[data-earned="true"]{background:#f3faf0;border-color:#c5ddba}
.dp-ach-card:hover{border-color:#81b5a6}.dp-ach-card:focus-visible,.dp-ach-back:focus-visible{outline:2px solid #68a995;outline-offset:2px}
.dp-ach-detail{text-align:center;background:#fffdf7;border:1px solid #e8e2d5;border-radius:22px;padding:24px 16px;margin-top:12px}
.dp-ach-detail .dp-ach-badge{width:132px;height:132px}.dp-ach-detail h3{font-size:18px;margin:12px 0}
.dp-ach-detail p{font-size:13px;line-height:1.8;margin:12px 0}.dp-ach-detail small{display:block;margin-top:16px;font-size:11px;color:#81786d}
.dp-ach-back{background:transparent;border:0;color:#578d7f;padding:8px 0;font:inherit;font-size:12px;cursor:pointer}
`
