# dsh-piggy 独立房间服务器

一个不依赖 Electron / 桌面版的内存房间服务器。一个进程托管一个房间，玩家进出不关房，`Ctrl-C`/SIGTERM 才停。

需要 Node.js 20+；没有第三方依赖，不用 `npm install`。

房间只同步猪的外观、位置和表情；不读写存档，不共享金币/背包。

## 直接运行

从仓库根目录：

```bash
# 域名 + Caddy/Nginx 反代（推荐）
node apps/room-server/server.mjs --public-url https://piggy.example.com
```

启动后会打印一行 JSON，里面有房间码和完整邀请串：

```json
{"ok":true,"code":"PIG-7K2M","invite":"https://piggy.example.com/#PIG-7K2M",...}
```

把邀请串发给朋友，他们在「联机 → 加入房间」粘贴即可。

## 公网 IP 直连（只建议测试）

```bash
node apps/room-server/server.mjs \
  --public-url http://203.0.113.8:47824 \
  --listen 0.0.0.0 --port 47824 --allow-public
```

需要云安全组/防火墙放行 TCP 47824。HTTP 不加密。

## 直接 HTTPS（不用反代）

```bash
node apps/room-server/server.mjs \
  --public-url https://piggy.example.com:8443 \
  --listen 0.0.0.0 --port 8443 \
  --tls-cert /path/fullchain.pem --tls-key /path/privkey.pem \
  --allow-public
```

证书必须匹配公网域名/IP；自签证书需要客户端系统信任。

## 参数

| 参数 | 说明 |
|---|---|
| `--listen <地址>` | 监听地址，默认 `127.0.0.1`（交给反代时保持默认） |
| `--port <端口>` | 监听端口，默认 `47824`；`0` 表示随机 |
| `--code <房间码>` | 固定 4 位房间码；不填则每次启动随机 |
| `--public-url <URL>` | 对外地址，如 `https://piggy.example.com` 或 `http://IP:47824` |
| `--tls-cert <文件>` | 直接 HTTPS 证书，与 `--tls-key` 一起 |
| `--tls-key <文件>` | 直接 HTTPS 私钥 |
| `--allow-public` | 监听 `0.0.0.0` 或公网 IP 时必须显式打开 |
| `--trust-proxy` | 采信反代的 `X-Forwarded-Host`；HTTPS 反代默认开启 |
| `--no-persistent` | 最后一位玩家离开后关闭房间（默认不关） |
| `-h, --help` | 帮助 |

## 反代示例

Caddy：

```caddyfile
piggy.example.com {
    reverse_proxy 127.0.0.1:47824
}
```

Nginx：

```nginx
location / {
    proxy_pass http://127.0.0.1:47824;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_read_timeout 30s;
}
```

## 说明

- **一个进程一个房间**。要同时开多个房间，用不同端口/进程；房间码每次启动可随机，也可用 `--code` 固定。
- 默认持久：玩家进进出出不会关房；要最后一人离开就关，用 `--no-persistent`。
- 没有数据库；进程重启后玩家列表、房间码都会重新开始。
- 没有管理后台；启动日志和 stdout JSON 就是状态。
- 房间服务没有内置账号体系，房间码是唯一加入凭证；公网请用 HTTPS。

## 已验证

- 本机反代模式：`Host: piggy.example.com` 加入/离开 200，邀请串为 `https://piggy.example.com/#PIG-...`。
- 本机直接 HTTPS：join / state / leave 200。
- 真实公网服务器直接 HTTPS（自签测试证书）：join / state / leave 200；第一位玩家离开后第二次加入仍 200，房间保持。
- 公网服务器测试结束后进程和临时目录已清理；部署时请用可信证书。
