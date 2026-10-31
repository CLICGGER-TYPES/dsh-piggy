# 本地审图工具

维护用户审图页、勾选与备注。勾选表示结构有问题、需要返修；**未勾选只表示没有选中问题，不表示批准**。反馈绑定图片 ID 与 SHA256；当前图片换版本后，旧反馈保留为历史，不自动结案。

本目录是审图工具的源码整理候选：恢复页面与反馈协议，补齐发布器的路径隔离和整批校验。**本页不声称任何 9388 服务正在运行**；从仓库外无法验证线上/本机服务状态。默认不启动服务、不接触现有审图目录、不改写反馈。

## 语义

- `checked_means_structure_needs_revision`：勾选是返修请求，不是通过。
- 未勾选、历史反馈 `active=false`、`approved/` 目录名都不能推断批准。
- 批准必须由用户明确给出，并绑定 `assetId + revision + outputSha256`。
- 生产侧身份/出处索引见 [docs/art/resource-index.md](../../docs/art/resource-index.md)；索引记录的是身份和出处，不是批准。
- 审图服务的 ID 是 `actor/scene`；生产资源索引的 ID 是 `pigs:<key>` / `fishing:<name>` / `animation:<name>`。只有能证明字节一致时才做映射，不按文件名猜。
- 六款新猪与钓鱼新动作的生产/绘图仍暂停；本目录不启动新绘图，也不改已批准资源字节。

## 使用

需要 Python 3，仅用标准库。`--root` 是给用户看的 HTML/图片目录，`--state-dir` 是不对外提供的状态目录；两者必须是**互不包含的真实目录**。服务只监听 `127.0.0.1`。

```sh
python3 tools/art-review/server.py \
  --root /absolute/review \
  --state-dir /absolute/review-state \
  --port 9388
python3 tools/art-review/read-issues.py --state-dir /absolute/review-state
```

隔离验证建议用 `--port 0`，由进程打印实际端口；不要把隔离验证指向正在使用的审图入口。

`read-issues.py` 必须显式传 `--state-dir`，没有默认路径。它输出 `active` 与 `previous_versions`；当前版本还要核对 `working_original_matches`，不能按文件名猜版本。

## 发布到审图副本

```sh
python3 tools/art-review/publish.py \
  --source /absolute/production \
  --public /absolute/review \
  --state-dir /absolute/review-state
```

发布器读取 `--source/delivery-manifest.json` 的 `records`；每条包含 `character`、`scene`、`original`、`export`、`sha256`。`original` 的散列不符会拒绝整批。发布器复制原稿与预览，给 `review.html` / `comparison.html` 接入勾选控件，并更新 `registry.json`。

### 发布器安全边界

发布前先校验，再写公开文件；校验失败不会留下“登记已换、图片没换”的半批状态。

- `--source`、`--public`、`--state-dir` 必须两两互不包含（解析符号链接后比较）；公共目录不能是源目录，状态目录不会被当作静态文件服务。
- `character` / `scene` 必须是单段安全路径；`/`、`\`、`..`、空段和控制字符会被拒绝。重复 ID、重复图片路径、非法 SHA256、缺失原稿或预览都会在写入前拒绝。
- `extra-images.json` 中的图片必须已在 `--public` 内、路径不越界、散列匹配，且 ID 不与主清单重复；这些也在写入前检查。
- 所有输出先落到 `--state-dir` 下的临时暂存目录；整批校验通过后才逐个原子替换公开文件。替换前把旧文件**复制**到 `--state-dir/rollback/`，因此 public 与 state 可以在不同文件系统；恢复时在目标目录写临时文件再原子替换，不跨根 rename。进程内任一步失败会尝试回滚公开文件和 `registry.json` / `publication.json`；**恢复本身失败不会静默吞掉**，错误会列出未恢复目标和保留的备份路径。断电、强杀或机器崩溃仍不能保证自动回滚，恢复要靠运行前的完整备份；暂存会临时占用与整批文件相当的磁盘空间。
- `registry.json` 最后写入；只有整批文件都落盘后才切换登记。上一轮登记但本轮不再使用的文件在登记切换后归档到 `--state-dir/previous-publications/<时间戳>/`，归档失败只报告 warning，不会把新登记回滚成旧登记；这些旧文件可能仍能按旧 URL 访问，但已不在登记里。
- `structure-issues.json` 不被发布器改写；同一稿重复发布不会清空勾选或备注。
- 文件系统、备份、回滚和归档辅助在 `publish_io.py`；`publish.py` 只做清单校验、页面渲染和登记，避免继续堆大单文件。

不要把它当成随意复制 HTML 的工具。运行前必须确认目标范围，备份登记、反馈和当前审图区。

## 备份、迁移与回退

迁移现有审图入口前，先只读备份：

- 整个工具目录和实际启动命令/参数；
- `registry.json`、`publication.json`、`extra-images.json`、`structure-issues.json`；
- 当前审图目录（`index.html`、`comparison.html`、`designs.html`、`images/`、`originals/`、`before/` 等）；
- 现有服务日志与进程信息（只记录，不重启）。

迁移步骤：

1. 在隔离临时目录复制一份登记、反馈和审图文件；用新源码在未使用端口启动，核对页面、ID、SHA256、勾选与备注。
2. 保持旧服务、旧文件和旧启动方式不变；不要用软链接替换现有运行目录冒充新版本。
3. 核对旧 URL 仍可打开：`index.html`、`comparison.html`、`designs.html`、`farm-review.html`、`farm-navigation.html`、`interaction-proposal.html`。发布器保留这些入口文件和 `actor/scene` ID，不重命名 ID。
4. 确认无差异后再切换；保留旧目录和回退命令。任何一步不确定就停，不要为整理目录清空历史。
5. 不把个人原始路径、逐字提示词或未批准资源写进运行时包；生产索引只引用仓库内相对出处。

## 隔离服务启动（给 T06）

T06 在自己的任务目录里准备独立的 `public/`、`state/`、`source/`，不要指向现有审图入口：

```sh
python3 tools/art-review/server.py --root "$T06/public" --state-dir "$T06/state" --port 0
```

浏览器用进程打印的 `http://127.0.0.1:<port>/` 打开。`feedback.js` 的 `file://` 跳转仍保留旧默认端口 9388；隔离验收请直接打开 HTTP 地址，不要用 `file://` 入口。

## 回归

```sh
python3 -m unittest discover -s tools/art-review -p 'test_review.py' -v
```

测试只使用临时目录和随机回环端口：勾选/备注保存后重读、图片换版时旧反馈保留、同一稿重复发布不覆盖反馈，以及发布器的目录重叠、重复 ID、缺失预览、越界路径和校验失败不写公开文件。测试不会连接或修改实际审图服务。

本次源码整理**没有运行**上述测试、没有启动服务、没有执行产品构建；验收由独立 T06 在 149 上完成。
