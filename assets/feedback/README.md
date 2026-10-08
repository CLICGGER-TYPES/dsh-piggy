# 反馈素材与状态立绘

本目录收录用户确认可用的 2026-10 生图 PNG：`single` 组 22 张，`collection` 组 16 张；两组的猪递为不同版式。文件名去掉了 `single/` 层级，合集文件加 `collection-` 前缀。图片由 OpenAI `image_gen.imagegen` 根据用户提供的原始小猪参考图生成，部分版本经多轮修正，所选版本在用户确认后接入。没有手绘、描摹或自动转换成 SVG。

`src/client/feedback-art.js` 只根据现有阶段、心情、工作、学习、外出、互动和闲置动作选择图片。初始纸盒显示猪递；死亡当天保留死猪图，满一天后显示墓碑旁的幽灵；寻访猪放在盲盒寻访页。内置特殊形态和用户导入的皮肤继续使用自己的立绘，打盹时继续用已确认的睡姿图。暂不制作或接入 GIF。

生成图片的使用条款见 [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/)。原始用户参考图片位于工作区 `feedback/`，审图总览和所选原尺寸 PNG 位于工作区 `dsh-piggy-artwork/feedback-static-svg/ai-drafts/selected-png/`；仓库只保存游戏使用的所选素材。来源为用户参考图与图像生成输出，没有从第三方插画包复制成品。

有些原图是 RGB 白底。场景中的 SVG 滤镜只在显示这些图片时去掉近白背景，原 PNG 不改；带透明通道的 PNG 直接显示。滤镜元素必须绝对定位，否则零尺寸 SVG 仍会形成一行高度，推走桌面猪。
