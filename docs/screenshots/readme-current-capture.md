# README 当前候选截图

拍摄日期：2026-10-25。游戏 0.37.2-rc.1 / 外壳 0.6.8-rc.1，菜园 4.1.5。该版本现已发布；以下仍为当时实拍，不代表后续版本。

在隔离 Linux 虚拟机中，用原生鼠标打开菜单、背包选种、点击地块播种、切换大小农场。图片来自实际 Electron 页面，只裁剪窗口或卡片边界，没有拼接、添加文字或修饰界面。主菜单显示候选版本号。

| 文件 | 像素 | SHA256 |
|---|---|---|
| readme-current-home.png | 292 × 371 | `6b245b34e5da329c23c9d9a3164936299e903802644a053401b414e4fa10073e` |
| readme-current-farm-small.png | 292 × 472 | `3654dcf51959568543c7128e2438640342d9384ffdf37710dbcefc12d9184b0f` |
| readme-current-farm-big.png | 1092 × 691 | `0d4f0ff5075c71111502a8562772d1e43ede5abd79e5a02f6ae75e13968e45bc` |

页面 DPR=1。小窗口视口292×520，大农场视口1092×691。角色为私有测试存档中的成年猪，图片中的作物通过真实鼠标播种。坏图、页面错误和控制台错误均为0。

这些截图展示当前候选界面，不代表公开稳定版0.37.1已包含所有改动。原截图与拍摄元数据保留在本轮验收交付目录。旧README截图保留作历史记录，不再用于当前README。

## 2026-10-26 RC3 主菜单

`readme-rc3-home.png`：游戏 0.37.2-rc.3 / 外壳 0.6.8-rc.2，Linux 虚拟机透明舞台。原生鼠标打开菜单并切回第一页，仅裁剪真实卡片边界；未合成或修改界面。DPR=1、小猪显示100%。

尺寸 292 × 335；SHA256 `cc350a9759d3d33694891ab7f42bb729503a12c2c68886a8cfd605b0418bf7a5`。原生整屏证据在 `rc3-20261026/linux/rc3-home-native.png`。

## 2026-10-27 RC4 Windows 图标与安装器候选

游戏0.37.2-rc.4 / 外壳0.6.8-rc.3，尚未公开发布。来源为[Windows原生验收40494946162](https://github.com/CLICGGER-TYPES/dsh-piggy/actions/runs/40494946162)，精确受测提交`2ddfe7f720f04b17ef99100e4e2330c65ff33bc5`。Windows Server 2025，1024×768、100%缩放，原生Win32鼠标/键盘；UIA只读。桌面截图按真实控件边界直接抓屏，其他两张保留实际安装窗口/整屏，未拼接或修饰。

开始菜单XAML可显示但不暴露辅助访问节点，依据实际截图用原生鼠标打开All apps并滚动，逐图确认D分组中的dsh-piggy；托盘同样逐图检查真实溢出面板。原始自动报告明确保留`visualReview=required`，最终验收由实际截图补齐，不将UIA读不到写成应用故障或自动通过。

| 文件 | SHA256 |
|---|---|
| readme-rc4-windows-installer.png | `84f38698085ad97550346b769104ba6e66c0b62ad2d5b6a94f8cfb2c138b38bd` |
| readme-rc4-windows-desktop.png | `cf9a7cbd6d09e2b177de73e399e9f0db1fd0b6cd15e5d8e0a4c19d719447d09e` |
| readme-rc4-windows-start.png | `28db32b69c40cb794a4b19d5df80c1714f3418f1c50344f79e1d37cc404fce5f` |

Windows18项原生流程通过；Linux真实AppImage与DSH17项通过。双平台各2226项检查零失败。macOS、混合DPI多屏没有本轮原生结论；便携版仅构建与哈希检查，未新增本轮原生启动验收。候选附件与截图统一审阅目录：`/zyx/agents/codex/deliverables/piggy-review/rc4-preparation-20261027/`。
