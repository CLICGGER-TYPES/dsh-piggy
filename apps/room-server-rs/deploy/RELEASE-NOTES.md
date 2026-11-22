<!-- 发布说明模板：release workflow 会替换 {{...}} 占位符，不要直接发布本文件。 -->
## dsh-piggy 独立房间服务器 {{VERSION}}

面向公网长期开房的独立服务器，和桌面版 / 游戏包分开发布。**不改变桌面客户端协议，也不塞进游戏包。**

- 发布标签：`{{TAG}}`
- 源码提交：`{{COMMIT}}`
- 协议：HTTP/1.1；`join / state / update / care / care-result / leave` 与现有桌面客户端兼容
- 联机对局：`--authority-url` / `--authority-secret` 把房间游戏事件转给 `room-authority`，支持左轮 1v1 开局（0.2.0 起；不配权威只能进房、不能开局）
- 状态：进程内存，无数据库；重启后玩家列表、房间码和照顾事件清空

### 下载

| 平台 | 文件 |
|---|---|
| Linux x86_64（glibc 2.17+） | `{{ASSET_X86_64}}` |
| Linux aarch64（glibc 2.17+） | `{{ASSET_AARCH64}}` |
| 校验和 | `SHA256SUMS` |

### 校验并安装二进制

```bash
VERSION={{VERSION}}
ARCH=x86_64   # ARM 服务器改成 aarch64
BASE=https://github.com/{{REPO}}/releases/download/{{TAG}}

curl -fLO "$BASE/dsh-piggy-room-server-$VERSION-linux-$ARCH.tar.gz"
curl -fLO "$BASE/SHA256SUMS"
sha256sum -c --ignore-missing SHA256SUMS

tar -xzf "dsh-piggy-room-server-$VERSION-linux-$ARCH.tar.gz"
sudo install -m 0755 \
  "dsh-piggy-room-server-$VERSION-linux-$ARCH/dsh-piggy-room-server" \
  /usr/local/bin/
dsh-piggy-room-server --version
dsh-piggy-room-server --help
```

### 部署（systemd + Caddy/Nginx 反代，推荐）

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin dsh-piggy
sudo install -m 0644 \
  "dsh-piggy-room-server-$VERSION-linux-$ARCH/deploy/dsh-piggy-room.service" \
  /etc/systemd/system/
sudo editor /etc/systemd/system/dsh-piggy-room.service   # 改 --public-url / --code
sudo systemctl daemon-reload
sudo systemctl enable --now dsh-piggy-room
sudo journalctl -u dsh-piggy-room -f
```

默认只监听 `127.0.0.1:47824`，由 Caddy/Nginx 终止 TLS；Caddyfile 和 nginx.conf 示例也在包的 `deploy/` 里。完整参数、直接 HTTPS、Docker 见包内 `README.md`。

### Docker

```bash
docker build -t dsh-piggy-room-server apps/room-server-rs
docker run --rm \
  -p 127.0.0.1:47824:47824 \
  dsh-piggy-room-server \
  --listen 0.0.0.0 --public-url https://piggy.example.com --allow-public
```

维护者启用 GHCR 推送时，也可以直接拉取本版本的镜像：

```bash
docker pull ghcr.io/{{REPO_OWNER_LOWER}}/dsh-piggy-room-server:{{VERSION}}
```

### 已知限制

- 一个进程一个房间，内存状态，无账号 / 管理后台 / 数据库；重启后房间码和玩家清空。
- 只支持 HTTP/1.1；公网长期使用请走 HTTPS 反代或直接 HTTPS。
- 预编译包面向 glibc 2.17+ 的 x86_64 / aarch64 Linux；Alpine/musl 请用 Docker 镜像或自行源码构建。
- 本发布与游戏 `v*` 发布相互独立；桌面客户端协议未改。
