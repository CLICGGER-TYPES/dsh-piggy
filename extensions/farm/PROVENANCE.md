# 菜园木托盘界面素材

2026-10-13 用户批准 farm-v4-ui 大农场 A 方向与小农场效果图。界面素材由项目 AI 出图流程生成，原稿、逐字提示词和审查记录保存于项目素材工作区 ext-ui 的 concepts/farm-v4-ui、sprites/farm-v4-ui、prompts 与 review。腾讯 QQ 农场只参考交互，不分发其图片。

打包脚本 scripts/pack-farm-ui.py 仅缩放及转 WebP，九宫格直接使用原图与 manifest inset；鼠标 48px、热点沿用原稿。接入 50 张，未使用的 5 张文字/别名/拆框图不打包。现有 191 张保持原样。

配色、圆角和动效参考 animal-island-ui 的 MIT 设计规范；使用原生 DOM、本项目字体及自有木质素材。

## 第4轮已审素材（2026-10-14）

用户与Claude批准 farm-v4-fix4 的16场景及UI V2。逐字提示词、原始生成图、审图和九宫格测量保存在素材工作区 ext-ui/prompts/2026-10-14-farm-v4-fix4 与 sprites/farm-v4-fix4。scripts/pack-farm-fix4.py 等比缩小并压缩为WebP；card-frame按美术source_rect拆正文和单个尾巴，下边采用指定直边样本，避免重复尾巴。fix4-art-pack.json记录导出母图与成品哈希、原始生成图出处、尺寸及字节数。旧场景物理文件保留，不再进入扩展声明包。

## 菜园界面整体重画（4.0.8）

用户选定大农场 B；晚间授权自主选择小农场 C1（连续羊皮纸），取消中间等待。原始设计、三个小农场方向、逐字提示词与审图见素材工作区 ext-ui/prompts/2026-10-15-farm-ui-redraw。内置 image_gen 生成两张透明母图，切图按现有 slice_helpers 离线清除低透明光晕、等比缩放、无损转 WebP。

新增 7 张透明图片，合计 40,520 字节，长边不超过 256px；逐图出处、原格、尺寸和 SHA-256 见 redraw-art-pack.json。263 张声明图片合计 4,229,070 字节，保留旧资源。三个未用候选仅留素材工作区。按钮、丝带、页签、卡片、进度条以原生 CSS 实现；有机弹框沿用 animal-island-ui MIT Modal 的 clip-path 几何，不引入 React。花叶、浅木纹与四个控件图标为生成图片。背景、作物和猪沿用既有来源。

游戏 0.37.0 与本次去除扩展图片张数/总字节上限一起发布时才可安装，因此 minGame 为 0.37.0。2026-10-15 用户授权随游戏 0.37.0 发布。
