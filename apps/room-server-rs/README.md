# dsh-piggy 独立房间服务器（Rust）

一个不依赖 Electron / Node.js 的内存房间服务器，编译成单个二进制。一个进程托管一个房间，只同步猪的外观、位置和表情，不读写存档、不共享金币或背包。

- 默认持久房间：玩家进出不关房，`Ctrl-C` / SIGTERM 才停。
- 协议与 `apps/desktop/lib/room-server.js` 兼容，现有桌面客户端不需要改动。
- 公网长期部署推荐使用本目录；仓库里的 Node 版 `apps/room-server/server.mjs` 保留为桌面内置 host 和回退方案。
- 没有数据库；进程重启后玩家列表、房间码和照顾事件都会清空。

## 下载预编译版本（Linux）

GitHub Release 的 `room-server-v*` 标签提供 Linux 预编译包，服务器不需要安装 Rust：

| 平台 | 文件 |
|---|---|
| Linux x86_64（glibc 2.17+） | `dsh-piggy-room-server-<version>-linux-x86_64.tar.gz` |
| Linux aarch64（glibc 2.17+） | `dsh-piggy-room-server-<version>-linux-aarch64.tar.gz` |
| 校验和 | `SHA256SUMS` |

发布页：<https://github.com/CLICGGER-TYPES/dsh-piggy/releases>

```bash
VERSION=0.1.0
ARCH=x86_64   # ARM 服务器改成 aarch64
BASE=https://github.com/CLICGGER-TYPES/dsh-piggy/releases/download/room-server-v$VERSION

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

包内包含二进制、README、CHANGELOG、LICENSE 和 `deploy/` 示例（systemd、Caddy、Nginx）。预编译包用 zigbuild 以 glibc 2.17 为基线，面向常见 x86_64 / aarch64 Linux；Alpine/musl 请用 Docker 镜像或从源码构建。

## 版本

`dsh-piggy-room-server --version` 输出 crate 版本；发布流水线会通过 `DSH_PIGGY_ROOM_SERVER_BUILD` 注入目标平台和提交号：

```text
dsh-piggy-room-server 0.1.0 (x86_64-unknown-linux-gnu@<commit>)
```

房间服务器版本与游戏 / 桌面版独立：`Cargo.toml` 的版本对应 `room-server-v<version>` 标签。维护者发布流程见 [docs/guides/room-server-release.md](https://github.com/CLICGGER-TYPES/dsh-piggy/blob/main/docs/guides/room-server-release.md)。

## 构建

需要 Rust 1.85+（已在 Rust 1.97 验证），不依赖 Node.js、OpenSSL 或系统 TLS 库。

从仓库根目录：

```bash
cd apps/room-server-rs
cargo test --locked
cargo build --release --locked
```

产物：

```text
apps/room-server-rs/target/release/dsh-piggy-room-server
```

安装到系统路径：

```bash
sudo install -m 0755 target/release/dsh-piggy-room-server /usr/local/bin/
dsh-piggy-room-server --help
```

### 交叉构建 aarch64（可选）

发布包用 `cargo-zigbuild` + zig 构建，目标 glibc 2.17：

```bash
rustup target add aarch64-unknown-linux-gnu
cargo install --locked cargo-zigbuild --version 0.24.1   # 只需一次
cargo zigbuild --release --locked --target aarch64-unknown-linux-gnu.2.17
```

产物在 `target/aarch64-unknown-linux-gnu/release/dsh-piggy-room-server`，可以用 `scripts/package-release.sh` 打包。x86_64 同理，把 target 换成 `x86_64-unknown-linux-gnu.2.17`。

## 快速开始

### 域名 + 反向代理（推荐）

服务器只监听回环，由 Caddy / Nginx 终止 TLS：

```bash
dsh-piggy-room-server --public-url https://piggy.example.com
```

启动后打印一行 JSON：

```json
{"ok":true,"code":"PIG-7K2M","invite":"https://piggy.example.com/#PIG-7K2M","listen":"127.0.0.1:47824","publicUrl":"https://piggy.example.com","protocol":"http","persistent":true,"tls":false}
```

把 `invite` 发给朋友，桌面版在「联机 → 加入房间」粘贴即可。房间码固定时加 `--code 7K2M`；不填则每次启动随机生成。

### 公网 IP + HTTP 直连（只建议测试）

```bash
dsh-piggy-room-server \
  --public-url http://203.0.113.8:47824 \
  --listen 0.0.0.0 --port 47824 --allow-public
```

需要云安全组/防火墙放行 TCP 47824。HTTP 不加密，房间码和玩家资料会明文经过网络，长期使用请上 HTTPS。

### 直接 HTTPS（不用反向代理）

```bash
dsh-piggy-room-server \
  --public-url https://piggy.example.com:8443 \
  --listen 0.0.0.0 --port 8443 \
  --tls-cert /etc/letsencrypt/live/piggy.example.com/fullchain.pem \
  --tls-key /etc/letsencrypt/live/piggy.example.com/privkey.pem \
  --allow-public
```

证书必须匹配公网域名/IP；自签证书需要客户端系统信任，否则桌面版会拒绝连接。

## 参数

| 参数 | 说明 |
|---|---|
| `--listen <地址>` | 监听地址，默认 `127.0.0.1`（交给反代时保持默认） |
| `--port <端口>` | 监听端口，默认 `47824`；`0` 表示随机 |
| `--code <房间码>` | 固定 4 位房间码；不填则每次启动随机 |
| `--public-url <URL>` | 对外地址，如 `https://piggy.example.com` 或 `http://IP:47824` |
| `--tls-cert <文件>` | 直接 HTTPS 证书链，与 `--tls-key` 一起 |
| `--tls-key <文件>` | 直接 HTTPS 私钥 |
| `--allow-public` | 监听 `0.0.0.0` 或公网 IP 时必须显式打开 |
| `--trust-proxy` | 采信反代的 `X-Forwarded-Host`；HTTPS 反代模式默认开启 |
| `--no-persistent` | 第一位玩家成为房主，房主离开后关闭房间（默认不关） |
| `--authority-url <URL>` | 本机权威进程的完整接口地址，例如 `http://127.0.0.1:47825/v1/game`；不配时公网房间没有开局权威，左轮不能开局 |
| `--authority-secret <密钥>` | 权威进程共享密钥，至少 16 字符，与权威进程的 `--secret` 一致 |
| `-V`, `--version` | 显示版本和构建目标 |
| `-h`, `--help` | 帮助 |

监听地址只接受具体 IPv4 或 `0.0.0.0`；`0.0.0.0` 和公网 IP 必须同时有 `--public-url` 和 `--allow-public`。HTTPS 公网地址没有证书时只能监听 `127.0.0.1` 给反代；HTTP 公网地址不能同时配 TLS 证书。

## TLS

- 只接受 PEM：证书链可以包含多张证书，私钥支持 PKCS#8、PKCS#1（RSA）和 SEC1（EC）。
- 启动时会校验证书和私钥是否匹配；文件不存在、PEM 损坏或不匹配都会直接退出。
- TLS 由 rustls 完成，不依赖 OpenSSL；默认支持 TLS 1.2 / 1.3。
- 直接 HTTPS 只协商 HTTP/1.1，和 Node 版行为一致。

## 反向代理

Caddy：

```caddyfile
piggy.example.com {
    reverse_proxy 127.0.0.1:47824
}
```

Nginx：

```nginx
server {
    listen 443 ssl;
    server_name piggy.example.com;

    ssl_certificate     /etc/letsencrypt/live/piggy.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/piggy.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:47824;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```

- 长轮询最长 15 秒，`proxy_read_timeout` 至少 20 秒。
- 反代要保留 `Host`，或传 `X-Forwarded-Host`；两者都对不上会被服务端 403。
- 公网只开放 443（或反代端口），不要直接把 47824 暴露出去。
- 房间服务会拒绝带 `Origin` 的浏览器跨域请求；这是现有协议的 Host/Origin 校验，不是 CORS 配置项。

## systemd

示例单元在 `deploy/dsh-piggy-room.service`。部署步骤（源码构建用 `target/release/`，预编译包用解压后的目录）：

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin dsh-piggy
sudo install -m 0755 target/release/dsh-piggy-room-server /usr/local/bin/
sudo install -m 0644 deploy/dsh-piggy-room.service /etc/systemd/system/
sudo editor /etc/systemd/system/dsh-piggy-room.service   # 改 --public-url / --code
sudo systemctl daemon-reload
sudo systemctl enable --now dsh-piggy-room
sudo journalctl -u dsh-piggy-room -f
```

默认单元只监听 `127.0.0.1:47824`，适合放在 Caddy/Nginx 后面。直接 HTTPS 时把 `ExecStart` 改成带 `--listen 0.0.0.0 --port 8443 --tls-cert ... --tls-key ... --allow-public` 的形式，并确认 `dsh-piggy` 用户能读取证书和私钥。

`deploy/Caddyfile` 和 `deploy/nginx.conf` 是可直接改域名使用的最小反代示例。

升级二进制（房间是内存状态，重启会清空当前房间码和玩家）：

```bash
sudo systemctl stop dsh-piggy-room
sudo install -m 0755 dsh-piggy-room-server /usr/local/bin/
sudo systemctl start dsh-piggy-room
dsh-piggy-room-server --version
```

## Docker

从仓库根目录构建：

```bash
docker build -t dsh-piggy-room-server apps/room-server-rs
```

反代模式（容器内必须监听 `0.0.0.0`，宿主机只发布回环端口）：

```bash
docker run --rm \
  -p 127.0.0.1:47824:47824 \
  dsh-piggy-room-server \
  --listen 0.0.0.0 --public-url https://piggy.example.com --allow-public
```

直接 HTTPS：

```bash
docker run --rm \
  -p 8443:8443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  dsh-piggy-room-server \
  --listen 0.0.0.0 --port 8443 \
  --public-url https://piggy.example.com:8443 \
  --tls-cert /etc/letsencrypt/live/piggy.example.com/fullchain.pem \
  --tls-key /etc/letsencrypt/live/piggy.example.com/privkey.pem \
  --allow-public
```

容器以 `dsh-piggy`（UID 10001）运行；没有数据卷，也没有需要持久化的文件。直接 HTTPS 时，挂载的证书和私钥必须对该 UID 可读（Let's Encrypt 的 `live/` 默认只有 root 可读）；做不到就继续用反代模式。

发布流水线可以在维护者开启 GHCR 推送后提供同版本镜像：

```bash
docker pull ghcr.io/clicgger-types/dsh-piggy-room-server:0.1.0
```

开启推送时会构建并推送 `linux/amd64` 和 `linux/arm64`；未开启推送时只构建 amd64 作为验证。

## 启动输出与日志

启动时 stdout 打印一行 JSON，字段固定为：

```text
ok / code / invite / listen / publicUrl / protocol / persistent / tls
```

- `code` 是显示用房间码，如 `PIG-7K2M`。
- `invite` 是完整邀请串；`publicUrl` 没有配置时为 `null`。
- `protocol` 是实际监听协议（反代模式下为 `http`，即使对外是 HTTPS）。
- `listen` 使用实际绑定端口，所以 `--port 0` 也能拿到真实地址。

运行日志也写 stdout，格式为：

```text
2026-11-16T07:39:11.540Z [room] room player joined
2026-11-16T07:39:20.101Z [room] room player left
2026-11-16T07:39:21.500Z [room] room closed (closed)
```

日志不输出 token 或 token 哈希，也不输出玩家存档内容。

## 行为与安全边界

- 一个进程一个房间；多个房间用不同端口和进程。
- 默认持久：最后一人离开也不关房；`--no-persistent` 时第一位玩家是房主，房主离开、超时或进程收到停止信号会关房。
- 关闭房间时，所有长轮询收到 `410 {"ok":false,"reason":...}`；之后的新请求返回 503。
- 最多 32 名玩家；同一 `clientId` 重复加入返回 409。
- token 是 32 字节随机值，服务端只保存 SHA-256；token 只出现在加入响应里。
- 加入限流默认每 IP 20 次 / 60 秒；房间满返回 429。
- 玩家 30 秒无请求会被清理（长轮询本身也会续期）。
- 房间码是唯一加入凭证；公网请始终用 HTTPS，不要把房间码贴到大型公开群。
- 没有账号、管理后台、数据库或跨进程共享状态。

## 与 Node 版的差异

线协议保持一致；同一个请求的响应字段和值已用 Node 版做过对比。实现上的差异：

- Rust 版支持 `--port 0`；Node 版会把 `advertisedPort` 传成 0 并在启动时报 `room advertised port is invalid`。Rust 版在随机端口时使用实际绑定端口。
- Rust 版会额外记录玩家加入日志；Node 版只记录离开。
- JSON 对象的 key 顺序不同（serde_json 会排序），客户端按字段读取，不受影响。
- Rust 版使用 rustls，不读取系统 OpenSSL 配置；Node 版使用 Node 自带 TLS。
- 两者都是单进程单房间、内存状态、无数据库。

## 开发与测试

```bash
cargo fmt --all -- --check
cargo test --locked
cargo build --release --locked
```

CI（`.github/workflows/room-server-ci.yml`）在 `apps/room-server-rs/**` 变更时跑同一组检查，并在 main 上额外做 aarch64 zigbuild 构建和 Docker 构建验证。发布 workflow 只在 `room-server-v*` 标签或手动触发时运行。

测试覆盖：

- 房间码归一化/生成、Host 校验、profile/位置/表情/照顾参数归一化、CLI 参数与校验、TLS 材料错误映射。
- 集成测试在随机端口启动服务，覆盖 join → state → update → state（长轮询被 bump 唤醒）→ care → care-result → leave，以及 401/403/409/410/413/415/429、32 人上限、反代 Host 和直接 HTTPS。
- 手工冒烟覆盖 HTTP 与自签 HTTPS 的 join/state/update/leave，以及 Node 版同请求响应对比。

## 目录

```text
apps/room-server-rs/
  src/
    main.rs        CLI、启动 JSON、信号
    cli.rs         参数解析、版本与启动校验
    server.rs      HTTP/HTTPS 监听、信封校验、路由
    room.rs        房间状态、令牌、长轮询、限流、清理
    protocol.rs    profile/位置/表情/照顾字段归一化
    room_code.rs   4 位房间码
    tls.rs         PEM 证书/私钥加载
    util.rs        JS 兼容的字符串/数字处理、时间、UUID
  tests/           集成测试与测试 TLS 材料
  deploy/          systemd、Caddy、Nginx、发布说明模板
  scripts/         预编译打包
  CHANGELOG.md     服务器独立版本变更
  Dockerfile       多阶段构建
```
