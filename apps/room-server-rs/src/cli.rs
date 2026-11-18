//! CLI 参数与 `apps/room-server/server.mjs` 对齐，错误信息保持中文。

use clap::{ArgAction, Parser};
use url::{Host, Url};

use crate::util::{is_safe_integer, js_number_from_str};

pub const DEFAULT_LISTEN: &str = "127.0.0.1";
pub const DEFAULT_PORT: u16 = 47_824;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// 发布流水线可通过 `DSH_PIGGY_ROOM_SERVER_BUILD` 注入目标平台和提交号；
/// 本地 `cargo build` 不设置时只显示 crate 版本。
const BUILD_INFO: Option<&str> = option_env!("DSH_PIGGY_ROOM_SERVER_BUILD");

pub fn version_text() -> String {
    match BUILD_INFO {
        Some(build) if !build.is_empty() => {
            format!("dsh-piggy-room-server {VERSION} ({build})")
        }
        _ => format!("dsh-piggy-room-server {VERSION}"),
    }
}

pub const HELP: &str = "\
dsh-piggy 独立房间服务器

用法：
  dsh-piggy-room-server [参数]

参数：
  --listen <地址>        监听地址，默认 127.0.0.1（交给反代时保持默认）
  --port <端口>          监听端口，默认 47824；0 表示随机
  --code <房间码>         固定 4 位房间码；不填则每次启动随机生成
  --public-url <URL>     对外地址，例如 https://piggy.example.com
                         或 http://203.0.113.8:47824
  --tls-cert <文件>      直接提供 HTTPS 证书（与 --tls-key 一起）
  --tls-key <文件>       直接提供 HTTPS 私钥
  --allow-public         监听 0.0.0.0 或公网 IP 时必须显式打开
  --trust-proxy          采信反向代理的 X-Forwarded-Host（HTTPS 反代默认开启）
  --no-persistent        最后一位玩家离开后关闭房间（默认不关）
  --authority-url <URL>  本机权威进程的完整接口地址，例如 http://127.0.0.1:47825/v1/game
  --authority-secret <密钥> 权威进程共享密钥（至少 16 字符）
  -V, --version          显示版本
  -h, --help             显示帮助

示例：
  # 域名 + Caddy/Nginx 反代（推荐）
  dsh-piggy-room-server --public-url https://piggy.example.com

  # 公网 IP + HTTP 直连（只建议测试）
  dsh-piggy-room-server --public-url http://203.0.113.8:47824 \\
    --listen 0.0.0.0 --port 47824 --allow-public

  # 直接 HTTPS（不用反代）
  dsh-piggy-room-server --public-url https://piggy.example.com:8443 \\
    --listen 0.0.0.0 --port 8443 --tls-cert cert.pem --tls-key key.pem --allow-public
";

#[derive(Debug, Clone)]
pub struct Args {
    pub listen: String,
    pub port: u16,
    pub code: String,
    pub public_url: String,
    pub tls_cert: String,
    pub tls_key: String,
    pub allow_public: bool,
    pub trust_proxy: bool,
    pub persistent: bool,
    pub authority_url: String,
    pub authority_secret: String,
    pub help: bool,
    pub version: bool,
}

impl Default for Args {
    fn default() -> Self {
        Self {
            listen: DEFAULT_LISTEN.to_string(),
            port: DEFAULT_PORT,
            code: String::new(),
            public_url: String::new(),
            tls_cert: String::new(),
            tls_key: String::new(),
            allow_public: false,
            trust_proxy: false,
            persistent: true,
            authority_url: String::new(),
            authority_secret: String::new(),
            help: false,
            version: false,
        }
    }
}

#[derive(Debug, Parser)]
#[command(
    name = "dsh-piggy-room-server",
    disable_help_flag = true,
    disable_version_flag = true,
    args_override_self = true
)]
struct Cli {
    #[arg(long, value_name = "地址")]
    listen: Option<String>,
    #[arg(long, value_name = "端口")]
    port: Option<String>,
    #[arg(long, value_name = "房间码")]
    code: Option<String>,
    #[arg(long = "public-url", value_name = "URL")]
    public_url: Option<String>,
    #[arg(long = "tls-cert", value_name = "文件")]
    tls_cert: Option<String>,
    #[arg(long = "tls-key", value_name = "文件")]
    tls_key: Option<String>,
    #[arg(long = "allow-public", action = ArgAction::SetTrue)]
    allow_public: bool,
    #[arg(long = "trust-proxy", action = ArgAction::SetTrue)]
    trust_proxy: bool,
    #[arg(long = "no-persistent", action = ArgAction::SetTrue)]
    no_persistent: bool,
    #[arg(long = "authority-url", value_name = "URL")]
    authority_url: Option<String>,
    #[arg(long = "authority-secret", value_name = "密钥")]
    authority_secret: Option<String>,
    #[arg(short = 'V', long = "version", action = ArgAction::SetTrue)]
    version: bool,
    #[arg(short = 'h', long = "help", action = ArgAction::SetTrue)]
    help: bool,
}

pub fn parse_args(argv: &[String]) -> Result<Args, String> {
    let cli = Cli::try_parse_from(
        std::iter::once("dsh-piggy-room-server".to_string()).chain(argv.iter().cloned()),
    )
    .map_err(|error| error.to_string())?;
    let mut args = Args::default();
    if let Some(value) = cli.listen {
        args.listen = value;
    }
    if let Some(value) = cli.port {
        args.port = parse_port(&value)?;
    }
    if let Some(value) = cli.code {
        args.code = value;
    }
    if let Some(value) = cli.public_url {
        args.public_url = value;
    }
    if let Some(value) = cli.tls_cert {
        args.tls_cert = value;
    }
    if let Some(value) = cli.tls_key {
        args.tls_key = value;
    }
    args.allow_public = cli.allow_public;
    args.trust_proxy = cli.trust_proxy;
    args.persistent = !cli.no_persistent;
    if let Some(value) = cli.authority_url {
        args.authority_url = value;
    }
    if let Some(value) = cli.authority_secret {
        args.authority_secret = value;
    }
    args.help = cli.help;
    args.version = cli.version;
    Ok(args)
}

fn parse_port(value: &str) -> Result<u16, String> {
    let number = js_number_from_str(value);
    if !is_safe_integer(number) || !(0.0..=65_535.0).contains(&number) {
        return Err("--port 必须在 0–65535".to_string());
    }
    Ok(number as u16)
}

#[derive(Debug, Clone)]
pub struct PublicUrl {
    pub protocol: &'static str,
    pub host: String,
    pub port: u16,
    pub origin: String,
}

pub fn parse_public_url(raw: &str) -> Result<Option<PublicUrl>, String> {
    if raw.is_empty() {
        return Ok(None);
    }
    let url = Url::parse(raw).map_err(|_| "--public-url 不是合法 URL".to_string())?;
    let protocol = match url.scheme() {
        "http" => "http",
        "https" => "https",
        _ => {
            return Err(
                "--public-url 只能写 http(s)://主机[:端口]/，不能带路径、账号或查询".to_string(),
            )
        }
    };
    if !url.username().is_empty()
        || url.password().is_some_and(|password| !password.is_empty())
        || url.query().is_some_and(|query| !query.is_empty())
        || url.fragment().is_some_and(|fragment| !fragment.is_empty())
        || (url.path() != "/" && !url.path().is_empty())
    {
        return Err(
            "--public-url 只能写 http(s)://主机[:端口]/，不能带路径、账号或查询".to_string(),
        );
    }
    let host = match url.host() {
        Some(Host::Ipv4(address)) => address.to_string(),
        Some(Host::Domain(domain)) => domain.to_ascii_lowercase(),
        // IPv6 会在 startServer 的 validRoomHost 检查里被拒绝；这里保留原文。
        Some(Host::Ipv6(address)) => format!("[{address}]"),
        None => return Err("--public-url 不是合法 URL".to_string()),
    };
    let port = url
        .port_or_known_default()
        .ok_or_else(|| "--public-url 不是合法 URL".to_string())?;
    if port == 0 {
        return Err("room advertised port is invalid".to_string());
    }
    Ok(Some(PublicUrl {
        protocol,
        host,
        port,
        origin: url.origin().ascii_serialization(),
    }))
}

pub fn validate(args: &Args, public_url: Option<&PublicUrl>) -> Result<(), String> {
    if args.listen.is_empty() {
        return Err("--listen 不能为空".to_string());
    }
    if (args.tls_cert.is_empty()) != (args.tls_key.is_empty()) {
        return Err("--tls-cert 和 --tls-key 必须一起提供".to_string());
    }
    if args.listen == "0.0.0.0" && public_url.is_none() {
        return Err("监听 0.0.0.0 时需要 --public-url，告诉客户端该连哪个地址".to_string());
    }
    if args.listen == "0.0.0.0" && !args.allow_public {
        return Err("监听 0.0.0.0 是公网暴露，必须显式加 --allow-public".to_string());
    }
    if public_url.is_some_and(|url| url.protocol == "https")
        && args.tls_cert.is_empty()
        && args.listen != "127.0.0.1"
        && args.listen != "localhost"
    {
        return Err("HTTPS 公网地址没有 TLS 证书时，只能监听 127.0.0.1 交给反向代理".to_string());
    }
    if public_url.is_some_and(|url| url.protocol == "http") && !args.tls_cert.is_empty() {
        return Err("HTTP 公网地址不能同时配 TLS 证书".to_string());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn parse_defaults() {
        let parsed = parse_args(&[]).expect("defaults");
        assert_eq!(parsed.listen, "127.0.0.1");
        assert_eq!(parsed.port, 47_824);
        assert!(parsed.persistent);
        assert!(!parsed.allow_public);
        assert!(!parsed.help);
        assert!(!parsed.version);
    }

    #[test]
    fn version_flag_and_text() {
        assert!(parse_args(&args(&["--version"])).expect("version").version);
        assert!(parse_args(&args(&["-V"])).expect("version short").version);
        assert!(version_text().contains(env!("CARGO_PKG_VERSION")));
        assert!(version_text().starts_with("dsh-piggy-room-server "));
    }

    #[test]
    fn parse_flags_and_values() {
        let parsed = parse_args(&args(&[
            "--listen",
            "0.0.0.0",
            "--port",
            "1e3",
            "--code",
            "7k2m",
            "--public-url",
            "https://piggy.example.com",
            "--allow-public",
            "--trust-proxy",
            "--no-persistent",
        ]))
        .expect("parsed");
        assert_eq!(parsed.listen, "0.0.0.0");
        assert_eq!(parsed.port, 1_000);
        assert_eq!(parsed.code, "7k2m");
        assert!(parsed.allow_public);
        assert!(parsed.trust_proxy);
        assert!(!parsed.persistent);
    }

    #[test]
    fn parse_rejects_bad_input() {
        assert!(parse_args(&args(&["--unknown"])).is_err());
        assert!(parse_args(&args(&["--port"])).is_err());
        assert!(parse_args(&args(&["--port", "65536"])).is_err());
        assert!(parse_args(&args(&["--port", "-1"])).is_err());
        assert_eq!(parse_args(&args(&["--help"])).unwrap().help, true);
    }

    #[test]
    fn public_url_normalizes_origin() {
        let parsed = parse_public_url("https://PIGGY.example.com/")
            .expect("valid")
            .expect("some");
        assert_eq!(parsed.protocol, "https");
        assert_eq!(parsed.host, "piggy.example.com");
        assert_eq!(parsed.port, 443);
        assert_eq!(parsed.origin, "https://piggy.example.com");

        let parsed = parse_public_url("http://203.0.113.8:47824")
            .expect("valid")
            .expect("some");
        assert_eq!(parsed.port, 47_824);
        assert_eq!(parsed.origin, "http://203.0.113.8:47824");

        assert!(parse_public_url("").expect("empty").is_none());
        assert!(parse_public_url("ftp://piggy.example.com").is_err());
        assert!(parse_public_url("https://piggy.example.com/path").is_err());
        assert!(parse_public_url("https://user:pass@piggy.example.com").is_err());
        assert!(parse_public_url("https://piggy.example.com/?a=1").is_err());
        assert!(parse_public_url("https://piggy.example.com/#x").is_err());
    }

    #[test]
    fn validation_matches_node_rules() {
        let mut parsed = Args::default();
        parsed.listen = "0.0.0.0".to_string();
        let error = validate(&parsed, None).unwrap_err();
        assert!(error.contains("--public-url"));

        let public = parse_public_url("http://203.0.113.8:47824")
            .unwrap()
            .unwrap();
        let error = validate(&parsed, Some(&public)).unwrap_err();
        assert!(error.contains("--allow-public"));

        parsed.allow_public = true;
        assert!(validate(&parsed, Some(&public)).is_ok());

        let https = parse_public_url("https://piggy.example.com")
            .unwrap()
            .unwrap();
        let error = validate(&parsed, Some(&https)).unwrap_err();
        assert!(error.contains("反向代理"));
        parsed.listen = "127.0.0.1".to_string();
        assert!(validate(&parsed, Some(&https)).is_ok());

        parsed.tls_cert = "cert.pem".to_string();
        parsed.tls_key = "key.pem".to_string();
        let error = validate(&parsed, Some(&public)).unwrap_err();
        assert!(error.contains("HTTP 公网地址"));
        parsed.tls_key.clear();
        let error = validate(&parsed, None).unwrap_err();
        assert!(error.contains("一起提供"));
    }
}
