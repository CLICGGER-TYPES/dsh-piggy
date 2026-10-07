#!/usr/bin/env bash
# 从维护者本机把一个版本发到 Gitee（维护者要求 2026-10-07：Gitee 一律从本机推，不让 GitHub Actions 推）。
#
# 用法（在仓库根目录）：
#   GITEE_TOKEN=<Gitee 私人令牌> bash scripts/gitee-publish.sh v0.33.1 [--run <GitHub Actions run id>]
#   （--run：指定用哪次构建的产物，不要求那次整体成功；不给就找该标签最近一次构建并等它成功）
#
# 做的事，按顺序，任何一步失败就停（不会删旧安装包）：
#   1. 等 GitHub 上该标签的 release-gitee 构建跑完，下载它的 artifact（gitee-game、gitee-dist-*）；
#   2. 本机 `git push gitee main` 和这个标签；
#   3. 建（或复用）Gitee 发行版，传游戏包、三个系统的安装包，最后传更新清单（latest*.yml）；
#   4. 核对：清单里的 sha512 和安装包一致、Gitee 上附件名字和大小都对；
#   5. 全对了才删旧版本的安装包附件（Gitee 单仓库附件总量 1GB）。
# 令牌只从环境变量读，不写进任何文件。
set -euo pipefail

TAG="${1:?用法：GITEE_TOKEN=… bash scripts/gitee-publish.sh vX.Y.Z [--run <id>]}"
RUN=""
if [ "${2:-}" = "--run" ]; then RUN="${3:?--run 后面要给 run id}"; fi
[ -n "${GITEE_TOKEN:-}" ] || { echo "先设 GITEE_TOKEN（Gitee 私人令牌）"; exit 1; }
cd "$(git rev-parse --show-toplevel)"
REPO=CLICGGER-TYPES/dsh-piggy
LIMIT=104857600

[ "v$(node -p "require('./package.json').version")" = "$TAG" ] || { echo "package.json 版本和 $TAG 不一致"; exit 1; }
git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { echo "本机没有标签 $TAG"; exit 1; }

# 1. 找到并等 GitHub 上的构建
if [ -z "$RUN" ]; then
  RUN=$(gh run list -R "$REPO" --workflow release-gitee.yml --limit 20 --json databaseId,headBranch \
    --jq "[.[] | select(.headBranch == \"$TAG\")][0].databaseId")
fi
[ -n "$RUN" ] && [ "$RUN" != "null" ] || { echo "GitHub 上找不到 $TAG 的 release-gitee 构建"; exit 1; }
if [ -z "${3:-}" ]; then
  echo "== 等构建 $RUN 跑完"
  gh run watch "$RUN" -R "$REPO" --exit-status >/dev/null || { echo "构建 $RUN 失败，先去 Actions 看原因"; exit 1; }
else
  # 手动指定 run 时不要求整次成功（比如旧流程上传 Gitee 那步卡住被取消，但构建产物已经存下来了）
  echo "== 用指定的构建 $RUN 的产物"
fi
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
echo "== 下载构建产物到 $WORK"
gh run download "$RUN" -R "$REPO" -D "$WORK"

GAME_FILES=()
for f in "$WORK"/gitee-game/game-*; do [ -f "$f" ] && GAME_FILES+=("$f"); done
NOTES="$WORK/gitee-game/notes.md"
INSTALLERS=()
MANIFESTS=()
for list in "$WORK"/gitee-dist-*/upload-list.txt; do
  dir=$(dirname "$list")
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    f="$dir/$rel"
    [ -f "$f" ] || { echo "清单里的 $rel 不在 artifact 里"; exit 1; }
    case "$(basename "$f")" in
      *.blockmap) ;;                       # 增量更新用不上，Gitee 也不需要
      latest*.yml) MANIFESTS+=("$f") ;;
      *) INSTALLERS+=("$f") ;;
    esac
  done < "$list"
done
[ "${#GAME_FILES[@]}" -gt 0 ] || echo "（这次构建没有 gitee-game：游戏包沿用发行版上已有的）"
[ "${#INSTALLERS[@]}" -gt 0 ] || { echo "没有安装包"; exit 1; }

# 4（先做一半）：清单里的 sha512 必须对得上同一批安装包，不然 Gitee 版自动更新会校验失败
for m in "${MANIFESTS[@]}"; do
  node -e '
    const fs = require("fs"), path = require("path"), crypto = require("crypto")
    const m = process.argv[1], text = fs.readFileSync(m, "utf8")
    const file = /path: (\S+)/.exec(text)[1], sha = /sha512: (\S+)/.exec(text)[1]
    const real = crypto.createHash("sha512").update(fs.readFileSync(path.join(path.dirname(m), file))).digest("base64")
    if (real !== sha) { console.error(path.basename(m) + " 的 sha512 和 " + file + " 对不上"); process.exit(1) }
    console.log("ok " + path.basename(m) + " ↔ " + file)' "$m"
done
for f in "${INSTALLERS[@]}" "${GAME_FILES[@]}"; do
  [ "$(stat -c %s "$f")" -le "$LIMIT" ] || { echo "$(basename "$f") 超过 Gitee 单附件 100MiB"; exit 1; }
done

# 2. 代码和标签
echo "== git push gitee"
git push gitee main
git push gitee "refs/tags/$TAG"

# 3. 发行版和附件（先传安装包，最后传更新清单：清单一出现，老用户就会按它来下载）
echo "== Gitee 发行版"
if [ -f "$NOTES" ]; then ID=$(node scripts/gitee-release.mjs ensure "$TAG" "$NOTES" | tail -1)
else ID=$(node scripts/gitee-release.mjs ensure "$TAG" | tail -1); fi
echo "发行版 id $ID"
[ "${#GAME_FILES[@]}" -eq 0 ] || node scripts/gitee-release.mjs upload "$ID" "${GAME_FILES[@]}"
node scripts/gitee-release.mjs upload "$ID" "${INSTALLERS[@]}"
[ "${#MANIFESTS[@]}" -eq 0 ] || node scripts/gitee-release.mjs upload "$ID" "${MANIFESTS[@]}"

# 4. 核对 Gitee 上的附件
echo "== 核对 Gitee 附件"
LIVE=$(curl -sS --max-time 30 "https://gitee.com/api/v5/repos/clicgger/dsh-piggy/releases/tags/$TAG")
for f in "${GAME_FILES[@]}" "${INSTALLERS[@]}" "${MANIFESTS[@]}"; do
  name=$(basename "$f"); size=$(stat -c %s "$f")
  node -e '
    const live = JSON.parse(process.argv[1]).assets ?? [], [name, size] = [process.argv[2], Number(process.argv[3])]
    const hit = live.find(a => a.name === name)
    if (!hit) { console.error("Gitee 上没有 " + name); process.exit(1) }
    if (hit.size != null && Number(hit.size) !== size) { console.error(name + " 大小不对：" + hit.size + " ≠ " + size); process.exit(1) }
    console.log("ok " + name)' "$LIVE" "$name" "$size"
done

# 5. 都对了才清旧版本的安装包
echo "== 删旧版本的安装包附件"
node scripts/gitee-release.mjs prune "$TAG"
echo "完成：https://gitee.com/clicgger/dsh-piggy/releases/tag/$TAG"
