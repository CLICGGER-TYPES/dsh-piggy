//! dsh-piggy 独立公网房间服务器（Rust 单二进制）。

pub mod cli;
pub mod protocol;
pub mod room;
pub mod room_code;
pub mod server;
pub mod tls;
pub mod util;

pub use server::{start_server, ServerHandle, ServerOptions};
