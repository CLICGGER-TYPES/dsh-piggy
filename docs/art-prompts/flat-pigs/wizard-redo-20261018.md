# 魔法师全姿势返工：实际提示词与采用记录

本轮使用内置 image_gen，transparent_background=true，没有使用CLI/API替代工具。共12次调用：首次idle整猪、10个姿势各一次整猪、最后独立帽子母版一次。提示词逐字保存于 prompts/，下文完整汇总；输入图只读，交付文件保存在本目录。

## 输入与采用

- 首次idle输入：基础idle / 上轮idle-v2衣服配色参考 / 0.36.1帽型参考。结果仍借用了旧猪脸型，整猪判废，只提取衣袍四角星。
- 十姿势输入：references/base-<pose>.png（实际 code/assets 基础256图等比重采样至1254，不独立裁边、居中或非等比变形）和帽型裁图 references/hat-master-source.png。pet采用shy-pet，relaxed采用blink，study/trip采用idle。整猪结果未直接交付：各图有坐标/比例漂移；sleep缺袍，pet/study/trip的衣帽也未完整遵循提示词。
- 最后独立帽子：输入仅帽型裁图，生成完整尖锥、金带、星星，无猪脸；去除离散背景碎点，将渐变压为锁定平涂色。最终同一母版509px宽，十张完全相同尺寸、方向和像素，仅按原头位做平移以贴合帽带；帽尖距上沿最小44px（eat、sleep、work帽子下移贴头），不更改帽型高度或弯尖。
- 最终制作：按“生图只当底稿”处理，基础猪保留原坐标/原五官；衣袍沿基础背部做服装遮罩拟合，平涂清稿；复用生成的金色四角星及最后独立帽。书本/背包仅从现魔法师相应图提取完整道具，不提取其猪体。服装遮罩、原图对齐关系和全部合成步骤见 build.py；从未用新生成猪脸覆盖基础猪。
- 本体所有姿势只做1254/256等比重采样；没有拉腿、放大脑袋、改鼻眼耳、改变身体角度或改变道具相对位置来迁就帽子。基础游戏图源分辨率只有256，因此1254导出保留源图的局部柔边，不声称其脸部是原生高清重画。

## 合成与审图

build.py只写本目录。低alpha脏边和孤立碎点清理，边界颜色取本地相邻内部颜色；五官、耳朵、腮红及其抗锯齿边回锁到基础原图。衣袍只覆盖背部，保留云垫、电脑、水盆和前景泡沫。十张采用同一帽子和同一星饰，避免逐张重生帽型。make_reviews.py生成原尺寸、原图两倍局部细节、游戏显示尺寸检查图。verify.py进行独立尺寸、alpha、帽尖边界、调色板、原五官像素和遮罩外改动检查。

以下按调用顺序列逐字提示词。

## 1. idle-attempt1-rejected.txt

```text
Use case: identity-preserve.
Asset: one 1254x1254 transparent RGBA game sprite, idle wizard pig.
Image 1 is the EXACT STRUCTURE EDIT TARGET, the base piglet. Image 2 is CLOTHING COLOR REFERENCE ONLY (its clipped hat is wrong). Image 3 is HAT SHAPE ONLY, correct 0.36.1 tall cone bending right.
Dress image 1 in the muted purple wizard robe and complete gold-banded wizard hat. Keep EXACT image 1 full-canvas position and ALL body proportions, face silhouette, eyes, nose, nostrils, pink ears, cheek, legs and curled tail. Do not borrow the body from images 2 or 3. This is a costume over the same pig, not a new character.
Hat should have an actual tall pointed cone, bending right, one gold four-point star, gold band. Hat highest pixel y>=40. Place the band around x=270..640 y=320 in 1254 canvas so a 280px tall cone fits, without moving face/ears/eyes. Preserve pink ears in front of the costume. Robe follows base back silhouette and does not reshape the body. No wand or extra props.
Style matches base: clean hand drawn FLAT muted fills, no outline, subtle upper-left light, no new texture or gradients. Purple #7F6FA3 / #B0A0CC / #6B598D, gold #D8BD76 / #E7CC87.
True alpha transparency, clean antialiased edges. No text, pseudo-text, watermark, melted details, meaningless asymmetry, noise, plastic highlights, conflicting illumination, muddy materials or tiny patterns. Save requested deliverable in current project directory if the host supports it.
```

## 2. idle-attempt2.txt

```text
Use case: identity-preserve. Edit image 1 ONLY by adding a muted purple wizard robe and hat. Image 1 is the absolute body, face, pose and placement reference. KEEP its exact pig silhouette, head/body ratio, facial features, pink ears, cheek, legs, tail and props IN PLACE, at unchanged size. Do not redesign or recenter the pig. Image 2 is HAT SHAPE ONLY, not a body reference. Hat is a tall complete cone bending to viewer right with one gold four point star and a gold band. Highest hat pixel must have >=40px transparent clearance on 1254x1254 canvas. Purple robe follows exact back outline, pale lavender front facing, two simple gold stars, single dark purple fold. Pink ears stay in front of garments and untouched. Clean flat hand-drawn fills with NO outlines, NO gradients, NO plastic shine. Purple #7F6FA3 #B0A0CC #6B598D, gold #D8BD76 #E7CC87. No text, fake lettering, texture noise, melting, tiny decorations, wand or additional props. True transparent background, clean alpha. Output one 1254x1254 sprite.
IDLE: pig standing on exact original short legs, eyes OPEN, no props. Costume must be fitted to this base pig's wide forehead.
```

## 3. eat-attempt2.txt

```text
Use case: identity-preserve. Edit image 1 ONLY by adding a muted purple wizard robe and hat. Image 1 is the absolute body, face, pose and placement reference. KEEP its exact pig silhouette, head/body ratio, facial features, pink ears, cheek, legs, tail and props IN PLACE, at unchanged size. Do not redesign or recenter the pig. Image 2 is HAT SHAPE ONLY, not a body reference. Hat is a tall complete cone bending to viewer right with one gold four point star and a gold band. Highest hat pixel must have >=40px transparent clearance on 1254x1254 canvas. Purple robe follows exact back outline, pale lavender front facing, two simple gold stars, single dark purple fold. Pink ears stay in front of garments and untouched. Clean flat hand-drawn fills with NO outlines, NO gradients, NO plastic shine. Purple #7F6FA3 #B0A0CC #6B598D, gold #D8BD76 #E7CC87. No text, fake lettering, texture noise, melting, tiny decorations, wand or additional props. True transparent background, clean alpha. Output one 1254x1254 sprite.
EAT: KEEP HEAD LOWERED INTO EXACT EXISTING FOOD BOWL. Keep nose touching food, exact body tilt and leg placement. Do not lift head. Keep food bowl precisely in place.
```

## 4. play-attempt2.txt

```text
Use case: identity-preserve. Edit image 1 ONLY by adding a muted purple wizard robe and hat. Image 1 is the absolute body, face, pose and placement reference. KEEP its exact pig silhouette, head/body ratio, facial features, pink ears, cheek, legs, tail and props IN PLACE, at unchanged size. Do not redesign or recenter the pig. Image 2 is HAT SHAPE ONLY, not a body reference. Hat is a tall complete cone bending to viewer right with one gold four point star and a gold band. Highest hat pixel must have >=40px transparent clearance on 1254x1254 canvas. Purple robe follows exact back outline, pale lavender front facing, two simple gold stars, single dark purple fold. Pink ears stay in front of garments and untouched. Clean flat hand-drawn fills with NO outlines, NO gradients, NO plastic shine. Purple #7F6FA3 #B0A0CC #6B598D, gold #D8BD76 #E7CC87. No text, fake lettering, texture noise, melting, tiny decorations, wand or additional props. True transparent background, clean alpha. Output one 1254x1254 sprite.
PLAY: KEEP FORWARD LEAN / LEAP towards exact existing ball. Preserve original diagonal body angle, lifted front legs and ball placement. Eyes OPEN as in base.
```

## 5. work-attempt2.txt

```text
Use case: identity-preserve. Edit image 1 ONLY by adding a muted purple wizard robe and hat. Image 1 is the absolute body, face, pose and placement reference. KEEP its exact pig silhouette, head/body ratio, facial features, pink ears, cheek, legs, tail and props IN PLACE, at unchanged size. Do not redesign or recenter the pig. Image 2 is HAT SHAPE ONLY, not a body reference. Hat is a tall complete cone bending to viewer right with one gold four point star and a gold band. Highest hat pixel must have >=40px transparent clearance on 1254x1254 canvas. Purple robe follows exact back outline, pale lavender front facing, two simple gold stars, single dark purple fold. Pink ears stay in front of garments and untouched. Clean flat hand-drawn fills with NO outlines, NO gradients, NO plastic shine. Purple #7F6FA3 #B0A0CC #6B598D, gold #D8BD76 #E7CC87. No text, fake lettering, texture noise, melting, tiny decorations, wand or additional props. True transparent background, clean alpha. Output one 1254x1254 sprite.
WORK: KEEP BODY LYING PRONE ON BELLY typing on laptop on floor. Keep exact stretched horizontal body and limbs, exact laptop. No standing pig, table, chair or stool.
```

## 6. sleep-attempt2.txt

```text
undefined
SLEEP: KEEP BODY LYING IN EXISTING BLUE CLOUD BED with original straight closed eye lines. Do not lift body. Keep blue cloud in exact position.
```

## 7. bathe-attempt2.txt

```text
undefined
BATHE: pig must remain SOAKING IN EXACT TURQUOISE TUB, front legs hang over rim. Preserve pig eyes/face/ear and foam. Fit purple robe only to visible upper back behind ear; retain waterline and foreground foam exactly. Wear complete pointed hat on head, no table.
```

## 8. pet-attempt2.txt

```text
undefined
PET: use exact base shy-pet structure and smiling crescent eyes/cheek. Keep body position and short legs. No additional props.
```

## 9. relaxed-attempt2.txt

```text
undefined
RELAXED: keep exact closed crescent eyes from base blink, same face and posture. No additional props.
```

## 10. study-attempt2.txt

```text
undefined
STUDY: exact original idle pig body unchanged. Add an OPEN BOOK on floor in front of feet, cream pages, muted rose cover, NO LETTERS OR PSEUDO TEXT. Do not change pig pose, face, legs or size to accommodate book.
```

## 11. trip-attempt2.txt

```text
undefined
TRIP: exact original idle pig body unchanged. Add small muted teal backpack over rear flank, cream clasp, keep original tail visible. Do not change pig pose, face, legs or size to accommodate bag.
```

## 12. hat-master-attempt3.txt

```text
Use case: precise-object-edit. Output ONLY one isolated wizard HAT, no pig, face, ears, body, robe or other object. Image 1 is the shape edit target: keep the same full tall purple cone bending to the viewer RIGHT, same one GOLD FOUR-POINT star, same curved pale gold band. Repair the entire LOWER EDGE OF GOLD BAND into a complete smooth continuous convex curved band: remove all skin-colored remnants and ear notches. This hat will be composited identically onto ten pigs. No crop or cut off edge of hat, transparent clearance on ALL sides at least 8%. Clean hand-drawn FLAT fills, muted purple #7F6FA3, shadow #6B598D, gold #E7CC87, NO gradients, NO texture, NO outlines, no glow. No text or watermark. True clean transparent RGBA, square canvas 1254x1254.
```
