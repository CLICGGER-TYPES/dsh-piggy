# 无描边平涂 PNG 素材

2026-10-13 由旧版 1:1 重画，当前只有一套无描边平涂，原有181张，另追加下文两张用户审定微动作。全部使用内置 image_gen 生成/编辑并经审图选定；角色、脸型、比例、姿势、服饰与道具沿用旧版，不以程序删除轮廓线。

已导出成品由 tools/prepare-flat-art.py 放入 base/forms/skins/feedback/badges 主路径。原尺寸原稿、参考和审图历史保留在独立素材工作区 face-restore/2026-10-12/。本次接入只使用已经导出的图片，不再修改像素。

每张选定版本、参考、源图和成品 SHA256、尺寸、透明边界、字节数及逐字提示词路径见 manifest.json；提示词保存在 docs/art-prompts/flat-pigs/。取景由 tools/measure-feedback-framing.py 读取透明边界重算，保持既有可见高度，不写图片。

感谢 @1nuoiscute 的原立绘与动作贡献，以及用户逐版反馈。Noto Emoji 衍生署名及许可继续保留在 THIRD-PARTY.md、LICENSE-noto-emoji.txt。历史图与未通过稿不随游戏包分发。

## 眨眼与摸猪害羞（2026-10-13）

用户审定 batch1 的 blink/01-closed 与 shy-pet/01-shy，原件已是 256×256 透明 PNG，逐字节复制，不裁切、调色或重新居中。逐字提示词随仓库保存，源图和成品哈希见 manifest.json。序列复用现有 idle（不重复存图），统一使用 idle 取景；闭眼 100ms，害羞 420ms。其余未通过动作不接入。

## 魔法师完整帽尖（2026-10-19）

用户审阅十动作总览后同意暂用此版。采用素材工作区 `art-source/pig-skins/wizard-redo-20261018/` 的十张 `*-256.png`，逐字节复制，不再加工图片。保留基础猪的五官与姿势，以生成帽子母版及离线服装合成修复帽尖；制作过程、采用与弃稿说明及逐字提示词见 `docs/art-prompts/flat-pigs/wizard-redo-20261018.md`。源稿与成品 SHA256、透明边界同步登记在 manifest.json；显示取景重新测量。此次批准仅代表先采用当前版本。

## 默认幼年猪去腮红（2026-10-27）

用户发现默认图只有单侧残缺腮红，明确要求去掉；两次imagegen局部修正均发生轮廓偏差，弃用，未进入资源目录。随后用户明确选择“脚本精确去腮红，保留原图”。本次仅处理幼年猪idle、blink和shy-pet三张现有PNG：分别替换152、169、168个腮红像素，以本图周围肤色填充，透明通道、256×256画布和所有区域外像素逐像素不变；鼻子、内耳、眼睛、腿、尾巴和姿势不变。

原稿仍可从已发布b4e47a8提交的同路径恢复；原始/成品SHA256、局部边界与像素数见manifest的retouch记录。逐像素验证与可复现脚本保存在制作工作区 `/zyx/agents/codex/deliverables/piggy-work/pig-no-blush-20261027/`，审阅副本在固定piggy-review目录。此用户授权仅适用于去腮红修复，不改变其他形象/服饰的原生出图要求。共用的art key与旧URL别名保持不变。

同轮核对发现桌面应用图标与托盘图标也使用同一单侧腮红。按同一用户授权精确去掉 `apps/desktop/build/icon.png` 的704像素和 `tray.png` 的15像素；原尺寸、透明通道及区域外像素逐字节不变。原稿、SHA256和像素边界见同一制作工作区 `icon-pixel-verification.json`，审图页另列两组前后对照；历史设计稿/截图不覆盖。
