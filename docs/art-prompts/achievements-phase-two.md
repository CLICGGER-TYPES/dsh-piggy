# 成就第二期徽章来源与导出

2026-11-02 按用户指定的现有 badge-pig-farm-ten.png 正常小猪徽章重做。保留正常横向身体、头部、耳朵、尾巴和站姿，仅改变六项成就的配色及身旁道具。使用内置 image_gen；此前的拟人姿势稿已替换。

角色与风格参考：assets/pigs/badges/badge-pig-farm-ten.png。Noto Emoji衍生署名沿用THIRD-PARTY.md及LICENSE-noto-emoji.txt。

母版 docs/screenshots/achievements-phase-two-badges.png 为1536×1024、3列×2行透明PNG。每格512×512切片后调用 tools/prepare-pig-art.py 的 prepare 导出256×256透明PNG。只做切片、透明噪声处理、等比缩放和调色板压缩，不以程序改画角色。母版/切片/成品哈希、切片坐标、大小和真实alpha>16边界见assets/pigs/manifest.json。

## 最终逐字提示词

```text
Create ONE production sprite sheet, exactly 3 columns by 2 rows, of six simple flat achievement badges based DIRECTLY on the attached badge. Treat the attached pig as LOCKED approved artwork: keep its exact original normal horizontal side-view body, head position, ears, eyes, snout, three visible short standing legs (the fourth is occluded), leg placement, curled tail, proportions and peach/pink colors. Reuse that same normal pig in every badge. Keep the same simple circular medallion and two short ribbons. Solid flat fills only, no gradients, no lighting, no shading, no texture, no outlines. Pig remains dominant. Small props sit BESIDE the pig at lower right as in the reference fruit basket. Do not lift any legs, do not make arms or hands, do not make it hold anything, do not alter or reinterpret its anatomy. No forehead ornaments.
Only change the badge color and small side props for each achievement:
Top-left: lavender badge, a small open fish field guide and one small blue fish at lower right.
Top-middle: pale blue badge, a small fish basket containing two blue fish and a short fishing rod leaning at lower right.
Top-right: pale peach badge, a small mint suitcase and seashell at lower right.
Bottom-left: pale yellow badge, a small wooden crate with carrots at lower right.
Bottom-middle: mint green badge, a small basket of carrot, tomato, corn and eggplant at lower right.
Bottom-right: slate blue badge, small pickaxe and one purple crystal at lower right. No helmet is needed; keep the pig identical.
The normal pig itself must look exactly like the reference in all six. These are small 256px game icons; use few clean simple shapes for props matching the reference. No text or numerals. Whole badge silhouettes fully visible, equal size, centered in equal square cells with ample transparent margins. Fully transparent alpha=0 outside badges and in gutters, no glow or shadow.
```

## 六处鼻旁高光移除

```text
Use case: precise-object-edit. Remove ONLY the SIX small solid WHITE DOTS immediately to the LEFT of each pig's pink snout in this six-badge sheet, one dot per pig. Reconstruct the covered tiny area with the same peach face color beneath, seamlessly. Preserve all actual eyes, black nostrils, snout shape, pink blush, ears, body, tail, normal standing legs, accessories, badge backgrounds, ribbons, proportions, positions, colors and transparency EXACTLY. Do not remove any other white areas such as the book pages or medal interior. Do not redraw the pigs or alter anatomy. No new details. Only six tiny white decorative face spots are removed. Keep the same 3 columns by 2 rows canvas dimensions and fully transparent outside-badge regions.
```
