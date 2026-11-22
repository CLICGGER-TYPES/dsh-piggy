# room-authority（公网房间对局权威）

公网房间里的联机对局由它判：接收房间服务器转发的事件，按扩展（目前是左轮）的在线规则推进对局、记 `seq`、替沉默一方判负。**状态只在内存里**，进程退出后未结束的对局丢失，不重连、不持久化。

- 只监听回环地址，由房间服务器转发；不要让公网直接访问。
- 一个进程可服务多个房间（按房间码区分），但一个房间服务器只对应一个房间。
- 只接受带 `x-room-authority` 头的请求，值和房间服务器的 `--authority-secret` 一致，至少 16 字符。

## 启动

```bash
# 需要 Node.js 20+
node apps/room-authority/authority.mjs --port 47825 --secret '至少十六个字符的共享密钥'
# 或把密钥放进环境变量，避免出现在 ps / shell history
ROOM_AUTHORITY_SECRET='至少十六个字符的共享密钥' node apps/room-authority/authority.mjs
```

启动成功输出：

```text
room-authority listening on http://127.0.0.1:47825
```

## 和房间服务器配对

```bash
dsh-piggy-room-server --public-url https://piggy.example.com \
  --authority-url http://127.0.0.1:47825/v1/game \
  --authority-secret '至少十六个字符的共享密钥'
```

- 房间服务器版本必须 ≥ 0.2.0（`room-server-v0.2.0` 起才有 `--authority-url`/`--authority-secret`）。
- 不配权威时公网房间能进房、不能开局，客户端会提示。
- 房间服务器会拒绝指向非回环地址的权威 URL，权威进程不要暴露公网端口。

## systemd 示例

`deploy/dsh-piggy-authority.service` 是一个可直接改路径的单元；密钥放 `EnvironmentFile`：

```bash
sudo install -d -m 0750 /etc/dsh-piggy
printf 'ROOM_AUTHORITY_SECRET=%s\n' '至少十六个字符的共享密钥' | sudo tee /etc/dsh-piggy/authority.env > /dev/null
sudo chmod 600 /etc/dsh-piggy/authority.env
sudo install -m 0644 deploy/dsh-piggy-authority.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dsh-piggy-authority
```

单元假定源码在 `/opt/dsh-piggy`、Node 在 `/usr/bin/node`，按实际部署改 `ExecStart` 和 `WorkingDirectory`。

## 测试

```bash
node --test apps/room-authority/test/authority.test.js
```

## 限制

- 内存状态：进程重启后，进行中的对局全部丢失；玩家需要重新开局。
- 没有鉴权之外的限流和审计；公网部署时把房间服务器放在反代后面，权威保持回环。
- 4 人桌规则仍待定，权威当前只实现 1v1（`docs/design/roulette-4p-online-proposal-20261118.md`）。
