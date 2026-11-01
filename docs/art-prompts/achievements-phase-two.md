# 成就第二期徽章来源与导出

内置 image_gen 生成。以项目 assets/pigs/badges/badge-pig-fish-five.png 为角色与画风参考。保持原有圆润横向身体和配色，两只前蹄微抬与书、鱼篓、菜筐和工具接触；后脚沿用原侧身站姿。只调整局部肢体与道具接触，不采用直立长身或道具单独摆放的试稿。非钓鱼主题移除额头鱼饰。Noto Emoji 衍生署名沿用 THIRD-PARTY.md 和 LICENSE-noto-emoji.txt。

母版 docs/screenshots/achievements-phase-two-badges.png 为1536×1024、3列×2行透明PNG。每格512×512切片后调用 tools/prepare-pig-art.py 的 prepare 导出256×256透明PNG；只做切片、透明噪声处理、等比缩放和调色板压缩，不以程序重画角色。母版/切片/成品哈希、坐标、大小和真实alpha>16边界见 assets/pigs/manifest.json。

## 初稿逐字提示词

```text
Use case: stylized-concept. Asset type: a single concept review board containing SIX distinct achievement badge designs for the dsh-piggy game, arranged in a precise 3 columns by 2 rows regular grid, no overlaps, generous transparent margins. Reference image is STYLE and CHARACTER IDENTITY reference only, not an edit target. Match its pink pig, tiny dark eyes, oval snout, flat soft pastel fills and minimal shapes; avoid gradients, 3D, lighting, realistic texture and black outlines. The pig is the largest motif in every badge. Each badge has a circular medallion and two short ribbons. Do not draw any text, letters, numbers, logos or watermark.
Top row left: fish naturalist, lavender medallion, pink pig with a tiny open field guide and two small blue fish. Top row middle: a hundred catches, sky blue medallion, pink pig with a small wooden fishing rod and a fish basket, exactly one pig. Top row right: travel souvenir collector, peach medallion, pink pig with a little mint travel bag and seashell.
Bottom row left: a hundred harvests, warm yellow medallion, pink pig holding a small crate of carrots. Bottom row middle: crop variety collector, mint medallion, pink pig and a small basket containing carrot, tomato, corn and eggplant in distinct colors. Bottom row right: deepest mine explorer, slate blue medallion, pink pig wearing a miner helmet, holding a small pickaxe beside a violet crystal.
Keep the same pig identity, medium, composition scale and ribbon proportions throughout. Actual transparent background, transparent spaces between badges. All six badges whole and fully visible. This is ONE concept sheet for review, not final individual game assets.
```

## 非钓鱼头饰调整

```text
Use case: precise-object-edit. Edit the attached SIX-badge review sheet. Remove ONLY the small PURPLE FISH lying across the forehead of the pig in these FOUR badges: top-right travel/souvenir badge, bottom-left carrot harvest badge, bottom-middle vegetable basket badge, bottom-right miner badge (fish partly below helmet). Seamlessly restore the pig forehead or helmet underneath. Preserve the actual ears, pink curled ear strokes, tail and all facial features. The top-left and top-middle fishing badges MUST remain entirely unchanged, including their purple forehead fish. Keep ALL other image content, positions, proportions, badge circles, ribbons, pigs, accessories, colors, soft rendering and background exactly as the input. Do not add text, decorations, new objects or symbols. Preserve existing alpha transparency exactly. It is a surgical removal of four fish only.
```

## 最终局部前蹄与道具接触调整

```text
Use case: precise-object-edit. Make a VERY LOCAL correction to the six-badge sheet. This original image's faces, colors, accessories, badge circles, ribbons, overall silhouette, body shape and composition are approved. KEEP THEM UNCHANGED.
The pig body must remain the original low rounded HORIZONTAL side-facing body with snout at left and rump/tail at right. Do not elongate it vertically, do not add a second torso, do not rotate it, do not add a second tail. No human upright pose. No red shoes.
Change ONLY the small foreleg shapes around the thematic accessories:
- Book pig: the two FRONT hooves should peek out at the two book edges as short subtly lifted forelegs attached to the chest at the left/front of the existing horizontal body. Remove the misplaced dangling front-leg stump below the book. Preserve the existing rear feet at right/back in their normal side-view stance.
- Fishing pig: one small forehoof touches the rod handle, the other rests lightly on the fish basket rim; raised only a little. Remove misplaced dangling front-leg shapes below those props. Keep rump and normal rear legs unchanged.
- Travel pig: one front hoof lightly rests on the travel bag and the other near the seashell, a small natural interaction, body unchanged.
- Carrot crate pig: two tiny forehooves rest on the crate's left/right top sides, not human hands. Remove any forelegs dangling below the crate; preserve the rear feet behind/right of it.
- Vegetable basket pig: two short subtly raised front hooves rest on the basket rim, body and rear legs unchanged.
- Miner pig: one short front hoof contacts the pickaxe HANDLE, the other lightly rests on the crystal. Keep the handle visibly WOODEN and distinct from peach limbs. Preserve the two rear legs and the original body.
Think of a normally horizontal four-legged pig lifting ONLY its two front feet slightly to engage with an item, while the back feet remain normally standing. NOT rearing its whole body, NOT sitting like a human, NOT four planted legs with a disconnected prop pasted nearby. No extra limbs. The two front hooves can be partly hidden by props; do not make them large.
Do not add fish on the non-fishing pigs. Do not add any head ornament. Keep all other pixels/design elements as close as possible to the original. Real transparent background outside badges, equal 3 by 2 grid.
```
