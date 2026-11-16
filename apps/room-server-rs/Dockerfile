# syntax=docker/dockerfile:1

FROM rust:1.97-bookworm AS build
WORKDIR /src

COPY Cargo.toml Cargo.lock ./
# 先编一个空壳，缓存第三方依赖；换源码时不用重新下载/编译依赖。
RUN mkdir -p src \
    && printf 'pub fn _placeholder() {}\n' > src/lib.rs \
    && printf 'fn main() {}\n' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src

COPY src ./src
# COPY 会保留较旧的 mtime，空壳构建的指纹不会被自动判脏；显式 touch 源文件再编译。
RUN find src -name '*.rs' -exec touch {} + \
    && cargo build --release --locked

FROM debian:bookworm-slim

RUN groupadd --gid 10001 dsh-piggy \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin dsh-piggy

COPY --from=build /src/target/release/dsh-piggy-room-server /usr/local/bin/dsh-piggy-room-server

USER dsh-piggy
EXPOSE 47824
STOPSIGNAL SIGTERM
ENTRYPOINT ["/usr/local/bin/dsh-piggy-room-server"]
