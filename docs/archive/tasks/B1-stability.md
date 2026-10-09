# B1 稳定：修审查出的 bug

**前置**：B0 已合入 main（`6984e89`）。**不涉及数值调整**，可以直接开工。
**编号**沿用 2026-09-30 代码审查清单。B0 已顺手修掉 #1（纸盒重启自己孵化）、#6（短工后整晚按在外算）、#8（同一时刻多条消息只显示一条），不在本卡。

每一条：先写会红的测试 → 改 → 变绿。

## 会丢数据的（先做）

- [x] **#4 兴趣课重启后消失，钱不退**
  - `core/migrate.js` 的 `sanitizeActivity` 只认 `work/study/trip`，加上 `interest`（校验 key 用 `interestByKey`）
  - `core/constants.js` 的 `AWAY_MOODS` 加 `interest`（现在显示「在打工」）；CSS 补 `data-away="interest"`
  - 测试：开一节兴趣课 → `migrate(JSON 往返)` → activity 还在
- [x] **#5 纪念品超过 40 个被删**
  - `core/migrate.js:~180` 的 `slice(-40)` 去掉（或改成很大的上限并在卖出时提示）；`snapshot.js:~283` 同理，不然超过 40 个后旧的卖不掉
  - 测试：41 个纪念品往返 migrate 后还是 41 个，snapshot 里也是 41 个

## 玩法错误

- [x] **#2 纸盒能被喂、能打工上学旅行、能生病死亡**
  - `startWork/startStudy/startTrip/startInterest/act` 开头加 `hatched !== true → { ok: false, reason: 'box' }`
  - `decay()` 里没孵化的纸盒不掉属性、不生病（在 `settlement.js` 的 `decay` 开头判断）
  - `feed()`（被动吃真实工作）对纸盒：只记 stats，不加 xp/属性
  - `snapshot` 对纸盒 `canGoOut: false`；客户端 `io.js` 的 reasons 加 `box: '先把纸盒拆开'`
- [x] **#7 病自己好了之后健康一直回不来**
  - 病愈（自愈或吃药）后健康回满 `MAX.health`，或者按时间每天回 1 格。**选前者，改动最小**；在卡里写明选择
  - **已按前者实现**：自愈分支原来只 +1（吃药那条本来就回满），现在两条路径都直接回满。
- [x] **疑似 #7：召回活动前没先结算**：`callOffActivity` 开头先 `decay(state, nowMs)`，已经结束的活动应该照常发工资而不是退款/作废

## 前端丢字段（#10，五处）

- [x] `normalize.js` 保留商店条目的 `worn`（`tabs/shop.js` 的「穿着」标签现在永远不显示）
- [x] `tabs/shop.js` 读的 `item.count` 不存在，改成快照里实际的字段名（查 `snapshot.js` 的 shop 部分）
- [x] `panel.js:~157` 每次渲染把 `data-dev` 设回 false，冲掉了调试图标高亮
- [x] `panel.js:~239` 学习图标提醒是 `? 'false' : 'false'`，永远亮不起来 —— 定一个真实条件（比如「空闲且有能上的课」），或者删掉这行
- [x] `panel.js:~105` 生病提醒报的是最便宜的药，改成 `currentIllness().cure` 对应的那味药

## 客户端 / 路由健壮性

- [x] **#11 Ctrl+Shift+D 监听泄漏**：`src/client/index.js` 的 `dispose()` 同时移除 `keydown`，并删掉 `window.dshPigDev`
- [x] **路由没兜底**：`routes.js:~134` 包 try/catch，异常返回 `{ ok: false, reason: 'error' }` 且状态码 500，日志带 action 名
- [x] **mutate 半路抛错也会保存**：`store.js` 的 `mutate` 在 core 抛异常时不保存、把内存状态回滚到调用前（`structuredClone` 快照）
- [x] **轮询覆盖刚做的动作**：`io.js` 的 `refresh` 加 in-flight 序号，比最近一次 `send` 早发出的轮询结果直接丢弃
- [x] **面板每 4 秒整页重建**：`panel.js:~65` 渲染前记下内容区 `scrollTop`，渲染后还原（最小改动，不做 diff）
- [~] **不做（用户 2026-10-01：本地插件没必要搞权限）** ~~`/dsh-pig/act` 没有鉴权~~：任何网页都能 POST `reset/dev/giveAll`。
  **方案（已调研，代码未动，等 Claude / 用户过目）**

  宿主侧现状（查过 `/zyx/DSH/deepseek-harness`）：
  - `packages/host/webserver` 只做 node:http 路由注册，文件头自述「knows no harness concepts」，
    `register({ kind, path, handler })` 没有 filter/中间件位，**没有给插件路由的鉴权钩子**。
  - 宿主自己的浏览器会话鉴权在 `packages/client/connection/src/browser-auth.ts`（HMAC 签名的
    `dsh-auth-*` cookie / `?token=`），另有 `api-request-trust.ts` 做 Host/authority 白名单；
    两者都只作用于 connection 插件的 RPC 载体，**没有作为服务暴露给插件**。
  - 结论：插件路由目前只有 loopback 一层。用户浏览器里任何页面都能
    `fetch('http://127.0.0.1:3080/dsh-pig/act', { method:'POST', body:'{"action":"reset"}' })` ——
    简单请求不触发预检，响应读不到也不影响，**副作用已经发生**（dev/reset/giveAll 尤其危险）。

  建议分三步，代价从低到高；第 1 步可以直接做，第 2/3 步需要拍板：
  1. **同源校验（建议先做）**：`content-type` 必须是 `application/json`；带 `Sec-Fetch-Site`
     时只接受 `same-origin` / `none`；带 `Origin` 时其 origin 必须与请求 Host 同源。不满足返回
     403 `{ ok: false, reason: 'forbidden' }`。跨站表单发不出 `application/json`，跨站 fetch 会带
     `Sec-Fetch-Site: cross-site`，两条都能挡；本地 curl/脚本没有任何这些头，不受影响（本来就能
     直接写存档文件，不是威胁模型的一部分）。
  2. **动作令牌**：插件启动时生成进程内随机 token，随快照下发（`GET /dsh-pig/state` 加
     `actionToken`），客户端 POST 时带 `x-dsh-pig-token`。跨源读不到快照正文（我们没有 CORS 头），
     拿不到 token；自定义头还会触发预检，而我们不应答预检 → 浏览器直接拦。需要留老客户端不带
     token 的过渡（例如「带对了 token」或「无 token 但 `Sec-Fetch-Site: same-origin`」都放行）。
  3. **Host 白名单**：只接受 Host 为 `127.0.0.1:<port>` / `localhost:<port>`（对齐宿主
     `api-request-trust` 的思路）。挡 DNS rebinding：恶意域名解析到 127.0.0.1 时浏览器视作同源，
     第 1、2 步都挡不住。

  需要定的：
  - 第 2、3 步做不做？第 1 步我可以直接实现并补测试（几行 + 一条 403 用例）；
  - 令牌放进快照，等于把「本进程的写权限」放在一个 GET 里 —— 跨源读不到，但用户浏览器装了
    恶意扩展的话任何方案都挡不住，这一点要接受；
  - 斜杠命令不走 HTTP，不受影响。

## 小缺口（有空就做）

- [x] 学习页默认停在锁住的学段（`src/client/index.js:~103`），改成默认第一个已解锁的
- [x] `/pig` 斜杠命令补 `interest` / `sell` / `wear` / `adopt` / `reply`
- [x] `io.js` 的 reasons 补 `weak`、`box`、`stale-line`（最后一个静默即可）
- [x] 调试页 `health: 0` 补一条死亡公告，而不是悄悄变成死猪

## 不在本卡

- #3 复活后立刻老死、#9 调试页年龄按钮对不上 —— B2 去掉老死后一起改
- 药名和疾病链对不上 —— B3

## 验证记录

**2026-10-01 · DSH agent**

- `npm run build && npm test`：**231 / 231 通过**（B1 开工前 196 → 新增 35 条，每条都先红后绿）
- `npm run typecheck`：**0 错误**
- 逐条提交（每条一个 commit，都在 main 上）：
  `07faced` #4 兴趣课 · `3c17806` #5 纪念品 · `9bf077a` #2 纸盒 · `185e122` #7 健康回满 ·
  `05dfb65` 召回先结算 · `6a1a527` #10 五处前端字段 · `b935ec4` #11 监听泄漏 ·
  `3cf1006` 路由兜底 · `cb1769e` mutate 回滚 · `44ea4a1` 轮询序号 · `3025ad3` 滚动位置 ·
  `4d4b3af` 鉴权方案 · `39fcee7` + `9d2fa50` + `064b00d` + `dec92da` 四条小缺口
- 界面验证：**`tools/preview.html`（仓库自带的伪宿主预览）**逐页签点过一遍 ——
  六个页签正常，商店会出现 `×2`（#10 的修复可见），状态/学习/打工/旅行/背包内容完整。
- **截图没能存下来**：chrome-devtools MCP 的 `take_screenshot(filePath)` 在本环境里
  拒绝所有目标路径（"not within any of the configured workspace roots"，仓库目录与
  `~/.dsh` 都试过），只能拿到内联图，无法落到 `docs/screenshots/`。
- README 里那套隔离实例（3082）：**起了、探活 401 正常**，但 app shell 没渲染
  （`#root` 为空、控制台无报错，拷贝出来的 home 启动异常，与本卡改动无关）。
  下一次要么换一台机器，要么让用户在自己的 3080 上确认。

**没做**：`/dsh-pig/act` 鉴权（方案见上，等拍板）；#3 复活后立刻老死、#9 调试页年龄按钮（B2）；药名与疾病链对齐（B3）。
