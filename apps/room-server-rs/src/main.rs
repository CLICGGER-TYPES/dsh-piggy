use dsh_piggy_room_server::cli::{
    parse_args, parse_public_url, validate, version_text, PublicUrl, HELP,
};
use dsh_piggy_room_server::room_code::{format_room_code, generate_room_code, normalize_room_code};
use dsh_piggy_room_server::server::{start_server, ServerOptions};
use dsh_piggy_room_server::tls::TlsMaterials;
use serde::Serialize;
use tokio::signal;

#[derive(Serialize)]
struct StartupInfo {
    ok: bool,
    code: String,
    invite: String,
    listen: String,
    #[serde(rename = "publicUrl")]
    public_url: Option<String>,
    protocol: &'static str,
    persistent: bool,
    tls: bool,
}

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        eprintln!("room-server: {error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let args = parse_args(&argv)?;
    if args.help {
        print!("{HELP}");
        return Ok(());
    }
    if args.version {
        println!("{}", version_text());
        return Ok(());
    }
    let public_url = parse_public_url(&args.public_url)?;
    validate(&args, public_url.as_ref())?;

    let tls = if args.tls_cert.is_empty() {
        None
    } else {
        let cert_pem = std::fs::read(&args.tls_cert)
            .map_err(|error| format!("--tls-cert 读取失败：{}: {error}", args.tls_cert))?;
        let key_pem = std::fs::read(&args.tls_key)
            .map_err(|error| format!("--tls-key 读取失败：{}: {error}", args.tls_key))?;
        Some(TlsMaterials { cert_pem, key_pem })
    };
    let tls_enabled = tls.is_some();
    let code = if args.code.is_empty() {
        generate_room_code()
    } else {
        normalize_room_code(&args.code)
            .ok_or_else(|| "--code 无效，应为 4 位，例如 7K2M".to_string())?
    };
    let advertised_host = match &public_url {
        Some(url) => url.host.clone(),
        None if args.listen == "0.0.0.0" => {
            return Err("需要 --public-url 或具体的 --listen 地址".to_string())
        }
        None => args.listen.clone(),
    };
    // Node 版把 --port 直接当作 advertisedPort，导致 --port 0 启动失败；
    // 这里在随机端口时用实际绑定端口，保证文档里的 --port 0 可用。
    let advertised_port = public_url
        .as_ref()
        .map(|url| url.port)
        .or(if args.port == 0 {
            None
        } else {
            Some(args.port)
        });
    let trust_proxy = args.trust_proxy
        || (public_url
            .as_ref()
            .is_some_and(|url| url.protocol == "https")
            && !tls_enabled);

    let options = ServerOptions {
        code: code.clone(),
        listen_address: args.listen.clone(),
        port: args.port,
        advertised_host: advertised_host.clone(),
        advertised_port,
        allow_public: args.allow_public,
        trust_proxy,
        persistent: args.persistent,
        authority: !args.authority_url.is_empty(),
        authority_url: if args.authority_url.is_empty() {
            None
        } else {
            Some(args.authority_url.clone())
        },
        authority_secret: if args.authority_secret.is_empty() {
            None
        } else {
            Some(args.authority_secret.clone())
        },
        tls,
        log: true,
        join_limit: Some(Default::default()),
    };
    let handle = start_server(options).await?;
    let port = handle.port();
    let protocol = if tls_enabled { "https" } else { "http" };
    let origin = match &public_url {
        Some(url) => url.origin.clone(),
        None => format!("{protocol}://{advertised_host}:{port}"),
    };
    let display_code = format_room_code(&code);
    let info = StartupInfo {
        ok: true,
        code: display_code.clone(),
        invite: format!("{}/#{}", origin.trim_end_matches('/'), display_code),
        listen: format!("{}:{port}", args.listen),
        public_url: public_url
            .as_ref()
            .map(|url: &PublicUrl| url.origin.clone()),
        protocol,
        persistent: args.persistent,
        tls: tls_enabled,
    };
    println!(
        "{}",
        serde_json::to_string(&info).map_err(|error| format!("启动信息序列化失败：{error}"))?
    );

    let mut stop_rx = handle.subscribe();
    let stop = async move {
        let _ = stop_rx.wait_for(|value| value.is_some()).await;
    };
    tokio::select! {
        _ = shutdown_signal() => {}
        _ = stop => {}
    }
    handle.close().await;
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut terminate = match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(signal) => signal,
            Err(_) => {
                let _ = signal::ctrl_c().await;
                return;
            }
        };
        tokio::select! {
            _ = signal::ctrl_c() => {}
            _ = terminate.recv() => {}
        }
    }
    #[cfg(not(unix))]
    {
        let _ = signal::ctrl_c().await;
    }
}
