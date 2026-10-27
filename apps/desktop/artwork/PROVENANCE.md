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

本次只准备下一次桌面打包资源；没有重发此前已验收的工程包，也没有替换维护者本地游玩AppImage。下一次外壳打包验收时核对实际安装器、桌面/开始菜单和托盘图标。
