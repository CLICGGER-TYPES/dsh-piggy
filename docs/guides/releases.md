# 发布渠道与版本

## 当前版本

| 部分 | 稳定版 | 预览版 |
|---|---|---|
| 游戏与 DSH 插件 | 0.37.2 | — |
| 桌面外壳 | 0.6.8 | — |
| npm | `latest` 0.37.0 | `rc` 由维护者手动发布 |
| 菜园扩展 | 4.0.10 | 4.5.0；经典版 3.2.4 |

- 稳定版：[GitHub v0.37.2](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.37.2)
- 上一预览版：[GitHub v0.37.2-rc.15](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.37.2-rc.15)
- 全部版本与逐版本变更：[Releases](https://github.com/CLICGGER-TYPES/dsh-piggy/releases) / [CHANGELOG](../../CHANGELOG.md)

预览版（RC）只更新 `rc` 标签，不改变稳定入口；预览版默认折叠在更新列表里，不弹气泡、不亮红点，也不会自动安装。

## 下载

| 渠道 | 内容 |
|---|---|
| GitHub | Windows / Linux 安装包、便携版、游戏包、farm/classic 扩展、`SHA256SUMS` |
| [夸克网盘](https://pan.quark.cn/s/0ef88e5bda2d) | Windows 安装包与便携版，国内手动下载 |
| Gitee | 不再发布新版本；历史附件只作回退 |

GitHub Release 的资产以 `SHA256SUMS` 为准。Windows 安装器另附五项默认不选的离线扩展，不会覆盖已有版本。

macOS 版本从 2026-11-06 起暂停构建：没有签名，也没有能长期维护的 macOS 实机，继续发布等于承诺无法验收的支持面。最后一个可用版本是 `v0.37.2-rc.15`（以及更早的 Releases）；代码和 `apps/desktop` 的 mac 构建配置保留，后续有维护者接手时可恢复 release workflow 的 mac job。

## npm

主包：<https://www.npmjs.com/package/dsh-piggy>  
别名包：<https://www.npmjs.com/package/dsh-plugin-piggy>

```sh
# 稳定版
dsh plugin --profile web add dsh-piggy

# 固定版本（npm 发布后）
dsh plugin --profile web add dsh-piggy@0.37.2
```

npm 由维护者按版本手动发布，GitHub Release 与 npm 可能相差一段时间。DSH 插件不会自动跟随 npm 升级，装哪一版由你决定。

## 升级顺序

桌面外壳与游戏包分开更新：

1. 先更新桌面外壳到配套版本。
2. 再更新游戏包。

Windows 安装版和 Linux AppImage 支持 App 内下载并重启安装外壳；Windows 便携版需到发布页手动替换。旧外壳会保留自带游戏，并提示先升级桌面程序。

## 历史归档

- 旧版主归档（夸克）：<https://pan.quark.cn/s/a4484e98dec8>
- RC3 国内原始包：<https://pan.quark.cn/s/80a3aa07111e>
- RC4 国内原始包：<https://pan.quark.cn/s/a1712a93536c>
- 历史 Gitee 附件仅供旧安装器回退，不代表当前版本。

历史安装器首次启动依赖的游戏包仍保留在 Gitee；新版本不再上传 Gitee。

## 验收边界

- Windows：单猪启动、孵化、面板、正常退出、重开保留存档、双猪共享金币、自动重启已实机通过。
- 三只猪窗口按槽位错开的修复在 rc.11 验证；混合 DPI 双屏仍需实机确认。
- macOS 已暂停构建与验收；真实跨设备 LAN/云、360 安全软件未验收。
- Owner LAN 仍是可信私网 HTTP，不支持 TLS/公网。

## 发布前检查

- [ ] 新 PR 作者是否进入 README 贡献者表
- [ ] 新贴图/素材是否写了出处、PROVENANCE 和致谢
- [ ] 新素材是否在 [LICENSE-ASSETS.md](../../LICENSE-ASSETS.md) 登记许可；AI 图、Noto 衍生猪图、字体是否用了正确许可
- [ ] 仓库当前树是否没有本机绝对路径（Linux home、Windows Users、挂载点）；旧提交里的历史路径是否需要单独处理
- [ ] CHANGELOG 是否提到对应贡献
- [ ] README 主图是否为当前版本实拍，不混用旧版本截图
- [ ] 游戏版本、桌面外壳版本、tag 三者一致
- [ ] Release 资产齐全，并上传 farm/classic 扩展与 `SHA256SUMS`
- [ ] npm 主包与别名包版本一致，`rc` 标签手动发布；包内包含 `LICENSE-ASSETS.md`、字体许可和素材
