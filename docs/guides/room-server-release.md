# 独立房间服务器：发布与部署资产

这份指南只覆盖 `apps/room-server-rs`（Rust 独立房间服务器）。它和游戏 / 桌面版的 `v*` 发布是两条独立发布链：

- 不改桌面客户端协议，不把服务器塞进游戏包。
- 版本号在 `apps/room-server-rs/Cargo.toml`，标签为 `room-server-v<version>`。
- 预编译包只发布到 GitHub Release，另可选推送 GHCR Docker 镜像。

## 发布链一览

| 触发 | Workflow | 做什么 |
|---|---|---|
| PR / push main（`apps/room-server-rs/**` 变更） | `.github/workflows/room-server-ci.yml` | `cargo fmt --check`、`cargo test --locked`、`cargo build --release --locked`、打包冒烟；main 上额外做 aarch64 zigbuild 和 Docker 构建 |
| push `room-server-v*` 标签 | `.github/workflows/room-server-release.yml` | 校验标签/版本、跑测试、构建 Linux x86_64 + aarch64、打包 tar.gz、生成 `SHA256SUMS`、创建/更新 GitHub Release；可选推送 GHCR |
| 手动 `workflow_dispatch` | 同上 | 对已有标签重新构建；可指定是否推送 GHCR |

发布 workflow 使用：

- `cargo-zigbuild` + `zig 0.17.1`：在普通 x86_64 runner 上分别构建 x86_64 / aarch64，目标 glibc 2.17。
- `docker/setup-qemu-action` + `docker/build-push-action`：多架构 Docker 构建。
- 版本注入：构建时设置 `DSH_PIGGY_ROOM_SERVER_BUILD=<target>@<commit>`，`--version` 会显示它。

## 产物命名

```text
dsh-piggy-room-server-<version>-linux-x86_64.tar.gz
dsh-piggy-room-server-<version>-linux-aarch64.tar.gz
SHA256SUMS
```

示例（0.1.0）：

```text
dsh-piggy-room-server-0.1.0-linux-x86_64.tar.gz
dsh-piggy-room-server-0.1.0-linux-aarch64.tar.gz
```

每个 tar.gz 内是：

```text
dsh-piggy-room-server-<version>-linux-<arch>/
  dsh-piggy-room-server
  README.md
  CHANGELOG.md
  LICENSE
  deploy/
    dsh-piggy-room.service
    Caddyfile
    nginx.conf
```

`SHA256SUMS` 由 release job 对两个 tar.gz 统一生成，放在 Release 资产根目录。

## 版本与标签

1. 修改 `apps/room-server-rs/Cargo.toml` 的 `version`。
2. 跑一次 `cargo check` / `cargo test`，让 `Cargo.lock` 里的根包版本同步；提交 `Cargo.toml` 和 `Cargo.lock`。
3. 更新 `apps/room-server-rs/CHANGELOG.md`。
4. 打标签并推送：

```bash
git tag -a room-server-v0.1.0 -m "room server 0.1.0"
git push origin room-server-v0.1.0
```

5. workflow 会校验 `room-server-v<Cargo version>`；不一致会直接失败，不会产出资产。

预发布版本用带 `-` 的版本号，例如 `0.2.0-rc.1`，标签 `room-server-v0.2.0-rc.1`；Release 会自动标为 prerelease，`latest` Docker 标签不会移动。

## 手动重跑

GitHub Actions 页面选 `room-server-release` → Run workflow，填已存在的标签：

```text
tag: room-server-v0.1.0
push_image: false
```

或：

```bash
gh workflow run room-server-release.yml \
  -f tag=room-server-v0.1.0 \
  -f push_image=false
```

重跑会重新构建并 `--clobber` 上传同名资产，不会移动标签。

## 本地复现发布包

```bash
cd apps/room-server-rs
cargo fmt --all -- --check
cargo test --locked

# 安装一次：zig 0.17.1（ziglang.org）和 cargo-zigbuild 0.24.1
cargo install --locked cargo-zigbuild --version 0.24.1

cargo zigbuild --release --locked --target x86_64-unknown-linux-gnu.2.17

version="$(cargo metadata --locked --no-deps --format-version 1 \
  | jq -r '.packages[] | select(.name == "dsh-piggy-room-server") | .version')"
bash scripts/package-release.sh x86_64-unknown-linux-gnu "$version" dist
tar -tzf "dist/dsh-piggy-room-server-$version-linux-x86_64.tar.gz"
```

aarch64 本地（接上一段，仍在 `apps/room-server-rs`）：

```bash
rustup target add aarch64-unknown-linux-gnu
cargo zigbuild --release --locked --target aarch64-unknown-linux-gnu.2.17
bash scripts/package-release.sh aarch64-unknown-linux-gnu "$version" dist

cd dist
sha256sum -- *.tar.gz > SHA256SUMS
sha256sum -c SHA256SUMS
```

两个包都以 glibc 2.17 为基线；可用 `readelf --version-info` 检查最高 `GLIBC_*` 符号。如果本机没有 zig 或 aarch64 target，直接依赖 CI 的 aarch64 job；不要在本地盲改交叉命令。

## GHCR 镜像（可选）

默认只构建 Docker 镜像，不推送。开启推送二选一：

- 标签推送：在仓库 Settings → Secrets and variables → Actions → Variables 添加 `ROOM_SERVER_PUSH_IMAGE=true`。
- 手动触发：`workflow_dispatch` 的 `push_image=true`。

推送目标：

```text
ghcr.io/<owner>/dsh-piggy-room-server:<version>
ghcr.io/<owner>/dsh-piggy-room-server:room-server-v<version>
ghcr.io/<owner>/dsh-piggy-room-server:latest   # 仅稳定版
```

workflow 需要 `packages: write`；仓库设置不允许 GITHUB_TOKEN 写 packages 时，保持 `ROOM_SERVER_PUSH_IMAGE` 未设置即可只构建。

本地构建：

```bash
docker build -t dsh-piggy-room-server apps/room-server-rs
docker run --rm dsh-piggy-room-server --version
```

## 发布后检查

- [ ] Release 标签是 `room-server-v<version>`，不是游戏 `v*`
- [ ] 两个 Linux tar.gz 和 `SHA256SUMS` 都在
- [ ] `sha256sum -c --ignore-missing SHA256SUMS` 通过
- [ ] x86_64 包内二进制 `--version` 显示版本和目标平台
- [ ] aarch64 CI / 构建日志没有 zigbuild 错误
- [ ] 发布说明里的下载、systemd、Docker 命令可复制执行
- [ ] 桌面客户端协议未改，游戏发布资产未被触碰

## 回滚

- 标签不可移动；需要重新出包时用同一标签手动重跑 workflow，或发新的补丁版本。
- 单个资产损坏：重新运行 release job，`gh release upload --clobber` 会覆盖同名文件。
- Docker 镜像回滚到上一个版本标签；`latest` 只在稳定版发布时移动。
- 房间服务器是无数据库的内存进程，回滚二进制不会迁移数据；重启即清空房间。

## 已知限制

- 预编译包面向 glibc 2.17+ 的 x86_64 / aarch64 Linux；Alpine/musl 用 Docker 或源码构建。
- 只支持 HTTP/1.1（与 Node 版一致）；公网长期使用请走 HTTPS。
- 没有代码签名、SBOM 或 SLSA 证明，目前只有 SHA-256 校验和 GitHub Release 本身。
- Docker 多架构构建在 amd64 runner 上用 QEMU 跑 arm64，耗时较长；只在推送时构建双架构。
- 一个进程一个房间、内存状态、无管理后台；发布链不提供多房间编排。
