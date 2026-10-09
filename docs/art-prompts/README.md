# 小猪生图提示词档案

这里保存已确认素材的**可复用提示词**，下次续画从这里开始，并以对应的已确认 PNG 作视觉参考。

- [反馈小猪](feedback-pigs.md)：`assets/feedback/` 的独立图与合集图。
- [睡姿小猪](sleep-poses.md)：`assets/*-sleep.png` 的普通猪和 11 种内置形态。

## 记录的准确性

前几轮生成时，没有逐字保存送入 `image_gen.imagegen` 的完整提示词；现存的 `assets/PROVENANCE.md` 和素材工作区 `feedback-static-svg/ai-drafts/PROVENANCE.md` 只记了提示词要点。因此本目录的长提示词是**依据已确认图片、用户反馈和生成记录整理的复用稿**，不能冒充当时的原文。工具提供的信息没有具体模型版本，也不要猜。

以后每次生图，先在这里新增一条记录，再调用生成工具。记录原样提示词、参考图文件、生成工具与已知版本、输出文件、审图结果和修改原因；每一轮单独留档，不把后来的整理稿写成旧提示词。正式素材只用用户确认的版本，废稿保留在素材工作区供对照。

工作区原始参考：`/zyx/DSH/workspaces/dsh-piggy/feedback/`。工作区审图包：`/zyx/codex/dsh-piggy-artwork/feedback-static-svg/ai-drafts/selected-png/` 和 `/zyx/codex/dsh-piggy-artwork/sleep-mat/`。这些路径是本机定位信息，不是仓库资源；跨机器时优先使用仓库内的已确认 PNG。

## 新一轮记录格式

```text
日期：
主题与版本：
工具及已知版本：
参考图：
完整提示词原文：
输出文件：
自查：主体轮廓 / 姿势与受力 / 道具遮挡 / 衣服 / 腿数 / 背景
用户结论与下一轮修改：
```
