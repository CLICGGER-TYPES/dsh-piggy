#!/usr/bin/env bash
# 打独立房间服务器的 Linux 预编译包。
#
# 产物：<输出目录>/dsh-piggy-room-server-<version>-linux-<arch>.tar.gz
# 包内：二进制、README、CHANGELOG、LICENSE、deploy/ 示例。
#
# 用法：
#   scripts/package-release.sh <target-triple> <version> [输出目录]
#
# 二进制默认从 target/<target-triple>/release/ 读取；本机原生构建且没有
# 指定 --target 时，回退到 target/release/。
set -euo pipefail

usage() {
  cat <<'EOF'
用法：scripts/package-release.sh <target-triple> <version> [输出目录]

示例：
  scripts/package-release.sh x86_64-unknown-linux-gnu 0.1.0 dist
  scripts/package-release.sh aarch64-unknown-linux-gnu 0.1.0 dist

前置：先构建目标平台的 release 二进制：
  cargo zigbuild --release --locked --target x86_64-unknown-linux-gnu.2.17
  cargo zigbuild --release --locked --target aarch64-unknown-linux-gnu.2.17

产物：
  <输出目录>/dsh-piggy-room-server-<version>-linux-<arch>.tar.gz
EOF
}

if [[ $# -lt 2 || $# -gt 3 ]]; then
  usage >&2
  exit 2
fi

target="$1"
version="$2"
out_dir="${3:-dist}"

app_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd -- "$app_dir/../.." && pwd)"
cd "$app_dir"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
  echo "无效版本号：$version（应类似 0.1.0 或 0.2.0-rc.1）" >&2
  exit 2
fi
if [[ ! "$target" =~ ^[a-z0-9_]+-unknown-linux-gnu$ ]]; then
  echo "只支持 Linux gnu 目标，收到：$target" >&2
  exit 2
fi

arch="${target%%-*}"
case "$arch" in
  x86_64 | aarch64) ;;
  *)
    echo "暂不发布该架构：$arch（只支持 x86_64 / aarch64）" >&2
    exit 2
    ;;
esac

pkg_name="dsh-piggy-room-server-${version}-linux-${arch}"
asset="${pkg_name}.tar.gz"

binary="$app_dir/target/$target/release/dsh-piggy-room-server"
if [[ ! -x "$binary" ]]; then
  host="$(rustc -vV | sed -n 's/^host: //p')"
  if [[ "$target" == "$host" && -x "$app_dir/target/release/dsh-piggy-room-server" ]]; then
    binary="$app_dir/target/release/dsh-piggy-room-server"
  else
    echo "找不到 $target 的 release 二进制：" >&2
    echo "  $app_dir/target/$target/release/dsh-piggy-room-server" >&2
    echo "先运行 cargo zigbuild --release --locked --target $target.2.17" >&2
    exit 1
  fi
fi

test -s "$app_dir/README.md"
test -s "$app_dir/CHANGELOG.md"
test -s "$repo_root/LICENSE"
for file in dsh-piggy-room.service Caddyfile nginx.conf; do
  test -s "$app_dir/deploy/$file"
done

mkdir -p "$out_dir"
out_dir="$(cd -- "$out_dir" && pwd)"
stage="$(mktemp -d "$out_dir/.stage.XXXXXX")"
trap 'rm -rf "$stage"' EXIT

pkg_dir="$stage/$pkg_name"
mkdir -p "$pkg_dir/deploy"
install -m 0755 "$binary" "$pkg_dir/dsh-piggy-room-server"
install -m 0644 "$app_dir/README.md" "$pkg_dir/README.md"
install -m 0644 "$app_dir/CHANGELOG.md" "$pkg_dir/CHANGELOG.md"
install -m 0644 "$repo_root/LICENSE" "$pkg_dir/LICENSE"
for file in dsh-piggy-room.service Caddyfile nginx.conf; do
  install -m 0644 "$app_dir/deploy/$file" "$pkg_dir/deploy/$file"
done

rm -f "$out_dir/$asset"
tar --owner=0 --group=0 --numeric-owner -czf "$out_dir/$asset" -C "$stage" "$pkg_name"
tar -tzf "$out_dir/$asset" >/dev/null

if command -v file >/dev/null 2>&1; then
  description="$(file -b "$binary")"
  printf '%s\n' "$description"
  case "$arch" in
    x86_64)
      [[ "$description" == *"x86-64"* ]] || {
        echo "二进制架构不是 x86_64：$description" >&2
        exit 1
      }
      ;;
    aarch64)
      [[ "$description" == *"ARM aarch64"* ]] || {
        echo "二进制架构不是 aarch64：$description" >&2
        exit 1
      }
      ;;
  esac
fi

printf '%s  %s\n' "$(sha256sum "$out_dir/$asset" | cut -d' ' -f1)" "$asset"
printf 'asset: %s\n' "$out_dir/$asset"
