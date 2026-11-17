# 变更记录

本文件只记录独立房间服务器（`apps/room-server-rs`）的发布；它和游戏 / 桌面版共用仓库，但版本和发布标签独立（`room-server-v*`）。

## 0.1.0（2026-11-17）

首个独立预编译发布。

- 单个 Rust 二进制，不依赖 Node.js、Electron、OpenSSL 或数据库。
- 线协议与桌面客户端 / `apps/desktop/lib/room-server.js` 兼容；本次发布不改客户端协议。
- Linux x86_64、aarch64 预编译包，附 `SHA256SUMS`。
- 新增 `--version` / `-V`，显示 crate 版本和构建目标。
- 提供 systemd、Caddy、Nginx、Docker 和直接 HTTPS 部署说明。
- 一个进程托管一个内存房间，默认持久；重启后玩家列表、房间码和照顾事件清空。
