# 自建公网联机服务器

桌面版的「联机」房间默认只连本机/局域网。这个版本起可以自己部署一台公网服务器，让不同网络的朋友也能进同一个房间。

房间只同步**外观、位置、表情**，不传存档、金币、背包。桌面版开房时房主退出就关房；独立服务器进程默认长期运行。

> 适合：有自己的服务器、公网 IP 或域名，能配防火墙和反向代理的人。
> 不适合：只想开箱即用、不想碰证书/端口的人。

## Rust 单二进制（推荐长期开）

仓库自带 `apps/room-server-rs/`，编译后是一个不依赖 Node.js / Electron 的单文件服务器。一个进程托管一个内存房间，默认持久：玩家进出不关房，`Ctrl-C`/SIGTERM 才停。

服务器只需要 Rust 工具链（1.85+）；不需要 `npm install`，也不依赖系统 OpenSSL。

不想在服务器上装 Rust 的话，GitHub Release 的 `room-server-v*` 标签提供 Linux x86_64 / aarch64 预编译包和 `SHA256SUMS`：

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
```

预编译包的下载、校验、systemd 和 Docker 完整命令见 [房间服务器 README](../../apps/room-server-rs/README.md)。

从仓库根目录构建：

```bash
cd apps/room-server-rs
cargo build --release --locked
```

产物是 `apps/room-server-rs/target/release/dsh-piggy-room-server`，可以安装到 `/usr/local/bin/` 后直接运行。

### 域名 + Caddy/Nginx 反代

```bash
dsh-piggy-room-server --public-url https://piggy.example.com
```

默认监听 `127.0.0.1:47824`，由反代终止 TLS。

启动后会打印一行 JSON，里面有房间码和完整邀请串：

```json
{"ok":true,"code":"PIG-7K2M","invite":"https://piggy.example.com/#PIG-7K2M",...}
```

把邀请串发给朋友即可。

### 公网 IP + HTTP（只建议测试）

```bash
dsh-piggy-room-server --public-url http://203.0.113.8:47824 \
  --listen 0.0.0.0 --port 47824 --allow-public
```

### 直接 HTTPS（不用反代）

```bash
dsh-piggy-room-server --public-url https://piggy.example.com:8443 \
  --listen 0.0.0.0 --port 8443 \
  --tls-cert /path/fullchain.pem --tls-key /path/privkey.pem --allow-public
```

- 默认 `--listen 127.0.0.1 --port 47824`，给反代用；
- `--code 7K2M` 固定房间码；不填每次启动随机；
- `--port 0` 使用随机端口，启动 JSON 里的 `listen` 是实际端口；
- `--no-persistent` 第一位玩家成为房主，房主离开就关房；
- 一个进程一个房间；多个房间用不同端口/进程；
- 完整参数、TLS、systemd 和 Docker 示例见 `apps/room-server-rs/README.md`。

## Node 版（桌面内置 / 回退）

桌面版内置的房间 host 仍使用 Node 实现；仓库保留 `apps/room-server/server.mjs`，参数和线协议与 Rust 版一致（Rust 版修复了 `--port 0`）。没有 Rust 工具链、或需要和桌面版同一套代码排查时可以用：

```bash
node apps/room-server/server.mjs --public-url https://piggy.example.com
```

公网长期部署优先用上面的 Rust 单二进制；Node 版需要 Node.js 20+，不安装第三方依赖。

## 网络接法

### A. 域名 + HTTPS（推荐）

适合有域名、能用 Caddy/Nginx 自动申请证书的服务器。

1. 域名解析到服务器；
2. 反向代理终止 TLS，转发到本机 `127.0.0.1:47824`；
3. Rust 独立服务器用 `--public-url https://piggy.example.com`（Node 版参数相同）；桌面版在「联机 → 公网服务器（可选）」填同一个地址；
4. 启动/创建后把邀请串 `https://piggy.example.com/#PIG-XXXX` 发给朋友。

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
- 反代要保留 `Host`，或者传 `X-Forwarded-Host`；两者都没有会被服务端 403。
- 游戏默认监听 `127.0.0.1:47824`；公网只开 443（或你给反代用的端口），不要直接把 47824 暴露出去。

### B. 公网 IP + HTTP（只建议测试）

没有域名、只想临时验证时：

1. Rust 独立服务器用 `--public-url http://203.0.113.8:47824 --listen 0.0.0.0 --port 47824 --allow-public`（Node 版参数相同）；桌面版在「公网服务器」填同一个地址；
2. 云安全组/防火墙放行 TCP 47824；
3. 邀请串会是 `http://203.0.113.8:47824/#PIG-XXXX`。

HTTP 不加密，房间码和玩家资料会明文经过网络；长期使用请上域名 + HTTPS。

## 桌面版直接开房（临时）

没有服务器时，桌面版也可以直接填公网地址开房；房主退出就关房，适合临时玩。长期开用上面的 Rust 单二进制（或 Node 版独立进程）。


1. 打开桌面版主面板的「联机」；
2. 展开「公网服务器（可选）」；
3. 填对外地址：
   - 域名 + HTTPS：`https://piggy.example.com`
   - 公网 IP 直连：`http://203.0.113.8:47824`
4. 点「创建房间」；
5. 复制完整的邀请串，发给朋友；
6. 房间窗口打开后，朋友的猪会进来。

> 填了公网地址后，邀请串里的房间码仍然有效；但公网模式不走局域网发现，跨网络请用完整邀请串，不能只输 4 位房间码。

## 朋友加入

「联机 → 加入房间」直接粘贴整条邀请串即可，支持：

```text
https://piggy.example.com/#PIG-XXXX
piggys://piggy.example.com:443#PIG-XXXX
piggy://203.0.113.8:47824#PIG-XXXX
```

也可以只输入 4 位房间码，但那只会在同一局域网里自动找房；跨网络必须用完整邀请串。

## 端口和防火墙

| 场景 | 本机监听 | 公网需要放行 |
|---|---|---|
| 独立服务器（Rust/Node）+ 反代 | `127.0.0.1:47824` | 443（或反代端口） |
| 独立服务器（Rust/Node）+ 直接 HTTPS | `0.0.0.0:8443` | 8443 |
| 公网 IP + HTTP 直连 | `0.0.0.0:47824` | 47824 |

- 云服务器除了系统防火墙，还要看**安全组/网络 ACL**；只开系统 `ufw` 不够。
- 局域网自动发现用 UDP 47823；公网模式不需要，也不走发现。
- 独立服务器（Rust/Node）一个进程一个房间；同名端口不能重复监听。

## 证书

- 客户端只信任系统证书链。Let's Encrypt、Caddy 自动证书、正规 CA 都可以。
- **自签证书会被游戏客户端拒绝**，除非你把证书装进系统信任。
- 证书域名必须和填写的对外地址一致；`https://IP` 需要证书里带这个 IP 的 SAN。

## 安全边界

- 房间码是唯一加入凭证；公网建议始终用 HTTPS。
- 服务端有加入频率限制，但不要把房间码贴到大型公开群。
- 不建全球账号/数据库；房间关闭即清空玩家列表和 token。
- 服务器、证书、防火墙、反代、访问控制都由部署者自己负责。
- 独立服务器进程（Rust/Node）可长期运行；桌面版开房需要桌面版保持运行，房主退出就关房。

## 常见问题

**403 forbidden**
反代没保留 `Host`/`X-Forwarded-Host`，或对不上填写的对外地址。检查 Nginx/Caddy 的 Host 头。

**连接被重置 / 超时**
安全组或防火墙没放行；也可能是端口被别的服务占用。换一个高位端口测试，确认是端口规则还是服务问题。

**加入时提示证书错误**
用了自签证书，或证书域名和填写地址不一致。换可信证书，或把自签证书加入系统信任。

**朋友只输入房间码找不到**
房间码只走局域网自动发现。跨网络请粘贴完整邀请串。

**不能加入自己**
客户端会拒绝加入本机正在开的同一个房间。

**房间突然关闭**
独立服务器（Rust/Node）默认持久，不会因为玩家离开关房；桌面版开房时房主退出/关窗/进程结束会关房。

## 实测记录

- 虚拟机通过宿主 `8443` 的 HTTPS 反代加入房间：join/state/leave 200。
- 真实公网服务器：
  - 直连 `http://<公网IP>:47824`：join/state/leave 200；
  - HTTPS 反代 `<公网IP>:8444`（自签测试证书）：join/state/leave 200。
- Node 版独立服务器 CLI 反代模式本机：带 `Host: piggy.example.com` 加入/离开 200，邀请串为 `https://piggy.example.com/#PIG-...`。
- Node 版独立服务器 CLI 在真实公网服务器上直连 HTTPS：join/state/leave 200；玩家离开后房间保持，第二次加入仍 200。
- Rust 单二进制本机 HTTP：join/state/update/state/leave 全部 200；`cargo test` 通过（34 个单元测试 + 8 个集成测试）。
- Rust 单二进制本机自签 HTTPS：join/state/leave 200；证书损坏或私钥不匹配时启动失败。
- Rust 单二进制反代模式本机：`Host: piggy.example.com` 加入 200，错误 Host 403，邀请串为 `https://piggy.example.com/#PIG-...`。
- Rust 与 Node 同请求对比：join/state/update/care/care-result 的响应字段和值一致（忽略 token、玩家 ID、事件 ID、时间戳等随机值）。
- 8443 被重置、8444 正常，属于端口/防火墙规则差异；生产建议 443 + 域名 + 可信证书。

