# 应用图标来源

2026-10-27 用户提供猪脸原图，并明确指定后续安装器、桌面/开始菜单快捷方式及应用图标使用此图。原图按原始字节保存；导出只做等比缩放和透明补方，不重画、换色或裁去内容。

| 文件 | 尺寸 | SHA256 |
|---|---|---|
| `app-icon-source-20261027.png` | 1138×1128 | `2b2e53acb7d8a6ab2d67816c3d27a657ac1286d7eb1192b44d76def8b1bcc92e` |
| `icon.png` | 512×512 | `d3435c1f571320d2e7d96be99989d9c502e709b5e05b869f19c8e8e43fce200d` |
| `tray.png` | 64×64 | `7ffd4531b4e6ff886298b8acbd875dd721b7e38c97836fcce87d9728260c78a6` |
| `icon.ico` | 256×256 | `15b74043c618157a70c62dccb6d2e55dd8ec954131a31358e64db68d1e8342a5` |

`app-icon-source-20261027.png` 是用户原图，不随游戏包或外壳运行资源分发。运行资源位于 `../build/`：`icon.png` 供窗口、Linux和macOS打包，`icon.ico` 供Windows安装版/便携版及快捷方式，`tray.png` 供普通窗口/透明舞台的托盘。

导出工具：ImageMagick。等比缩放后透明补到512×512 / 64×64，Windows ICO包含16/32/48/64/128/256六档。

```sh
magick app-icon-source-20261027.png -strip -resize 512x512 -background none -gravity center -extent 512x512 PNG32:../build/icon.png
magick app-icon-source-20261027.png -strip -resize 64x64 -background none -gravity center -extent 64x64 PNG32:../build/tray.png
magick ../build/icon.png -define icon:auto-resize=256,128,64,48,32,16 ../build/icon.ico
```

2026-10-27已完成[Windows原生安装验收](https://github.com/CLICGGER-TYPES/dsh-piggy/actions/runs/40494946162)，受测源码`2ddfe7f720f04b17ef99100e4e2330c65ff33bc5`：Shell解码安装器、应用、卸载程序和两类快捷方式均匹配指定ICO；桌面、开始菜单和托盘实拍逐图检查通过。18项安装流程通过，开始菜单/托盘的辅助访问限制与截图来源见[拍摄记录](../../../docs/screenshots/readme-current-capture.md#2026-10-27-rc4-windows-图标与安装器候选)。

候选尚未公开发布，未修改维护者本地游玩AppImage、快捷方式或存档；Linux/macOS桌面图标显示不据此宣称已完成原生验收。
