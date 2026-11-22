//! HTTP/HTTPS 监听、请求信封校验与路由。

use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::Duration;

use axum::body::{to_bytes, Body};
use axum::extract::{ConnectInfo, State};
use axum::http::{header, Method, Request, StatusCode};
use axum::response::Response;
use axum::Router;
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::service::TowerToHyperService;
use serde_json::{json, Map, Value};
use tokio::io::{AsyncRead, AsyncWrite};
use tokio::net::TcpListener;
use tokio::sync::watch;
use tokio::task::JoinHandle;
use tower::ServiceExt;

use crate::protocol::{exact_keys, normalize_client_id, ROOM_MAX_BODY};
use crate::room::{ApiError, JoinLimit, Room, RoomOptions, StateOutcome};
use crate::tls::{build_acceptor, TlsMaterials};
use crate::util::json_safe_integer;

#[derive(Debug, Clone)]
pub struct ServerOptions {
    pub code: String,
    pub listen_address: String,
    pub port: u16,
    pub advertised_host: String,
    pub advertised_port: Option<u16>,
    pub allow_public: bool,
    pub trust_proxy: bool,
    pub persistent: bool,
    pub authority: bool,
    pub authority_url: Option<String>,
    pub authority_secret: Option<String>,
    pub tls: Option<TlsMaterials>,
    pub log: bool,
    pub join_limit: Option<JoinLimit>,
}

impl Default for ServerOptions {
    fn default() -> Self {
        Self {
            code: "7K2M".to_string(),
            listen_address: "127.0.0.1".to_string(),
            port: 0,
            advertised_host: "127.0.0.1".to_string(),
            advertised_port: None,
            allow_public: false,
            trust_proxy: false,
            persistent: true,
            authority: false,
            authority_url: None,
            authority_secret: None,
            tls: None,
            log: false,
            join_limit: Some(JoinLimit::default()),
        }
    }
}

pub struct ServerHandle {
    port: u16,
    room: Arc<Room>,
    task: JoinHandle<()>,
}

impl ServerHandle {
    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn room(&self) -> Arc<Room> {
        self.room.clone()
    }

    pub fn subscribe(&self) -> watch::Receiver<Option<String>> {
        self.room.subscribe()
    }

    /// 主动关闭房间并等待监听循环退出。重复调用是安全的。
    pub async fn close(self) {
        self.room.close("closed");
        let _ = tokio::time::timeout(Duration::from_secs(3), self.task).await;
    }

    /// 等待房间关闭（例如 `--no-persistent` 的房主离开）。
    pub async fn wait(self) -> String {
        let _ = self.task.await;
        self.room.close_reason()
    }
}

struct Authority {
    url: String,
    secret: String,
    client: reqwest::Client,
}

struct App {
    room: Arc<Room>,
    authority: Option<Arc<Authority>>,
}

fn build_authority(options: &ServerOptions) -> Result<Option<Arc<Authority>>, String> {
    match (&options.authority_url, &options.authority_secret) {
        (None, None) => Ok(None),
        (Some(url), Some(secret)) => {
            if secret.chars().count() < 16 {
                return Err("authority secret must be at least 16 characters".to_string());
            }
            let parsed =
                url::Url::parse(url).map_err(|_| "authority url is invalid".to_string())?;
            if parsed.scheme() != "http" && parsed.scheme() != "https" {
                return Err("authority url must be http or https".to_string());
            }
            if !matches!(
                parsed.host_str(),
                Some("127.0.0.1") | Some("localhost") | Some("::1")
            ) {
                return Err("authority must listen on loopback".to_string());
            }
            let client = reqwest::Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .map_err(|_| "authority client failed".to_string())?;
            Ok(Some(Arc::new(Authority {
                url: url.clone(),
                secret: secret.clone(),
                client,
            })))
        }
        _ => Err("--authority-url and --authority-secret must be provided together".to_string()),
    }
}

pub async fn start_server(options: ServerOptions) -> Result<ServerHandle, String> {
    validate_listener(&options)?;
    let authority = build_authority(&options)?;
    let authority_enabled = authority.is_some();
    let tls_acceptor = match options.tls.as_ref() {
        Some(materials) => Some(build_acceptor(materials)?),
        None => None,
    };

    let listen_ip: Ipv4Addr = options
        .listen_address
        .parse()
        .map_err(|_| "room listener must be an IPv4 address".to_string())?;
    let listener = TcpListener::bind(SocketAddr::new(IpAddr::V4(listen_ip), options.port))
        .await
        .map_err(|error| {
            format!(
                "failed to listen on {}:{}: {error}",
                options.listen_address, options.port
            )
        })?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("failed to read listener address: {error}"))?
        .port();

    let (shutdown_tx, shutdown_rx) = watch::channel(None);
    let room = Room::new(
        RoomOptions {
            code: options.code,
            advertised_host: options.advertised_host.to_ascii_lowercase(),
            advertised_port: options.advertised_port,
            actual_port: port,
            persistent: options.persistent,
            trust_proxy: options.trust_proxy,
            authority: authority_enabled,
            join_limit: options.join_limit,
            log: options.log,
        },
        shutdown_tx,
    )?;
    let router = Router::new()
        .fallback(handle_request)
        .with_state(Arc::new(App {
            room: room.clone(),
            authority,
        }));
    let task = tokio::spawn(run_accept_loop(
        listener,
        tls_acceptor,
        router,
        room.clone(),
        shutdown_rx,
    ));
    Ok(ServerHandle { port, room, task })
}

fn validate_listener(options: &ServerOptions) -> Result<(), String> {
    let address: Ipv4Addr = options.listen_address.parse().map_err(|_| {
        "room listener requires a private/loopback IPv4, or allowPublic for a public address"
            .to_string()
    })?;
    let kind = address_kind(address);
    if (address.is_unspecified() || kind == "public") && !options.allow_public {
        return Err(
            "room listener requires a private/loopback IPv4, or allowPublic for a public address"
                .to_string(),
        );
    }
    Ok(())
}

fn address_kind(address: Ipv4Addr) -> &'static str {
    let [a, b, ..] = address.octets();
    if a == 127 {
        "loopback"
    } else if a == 10 || (a == 172 && (16..=31).contains(&b)) || (a == 192 && b == 168) {
        "private"
    } else if a == 169 && b == 254 {
        "link-local"
    } else {
        "public"
    }
}

async fn run_accept_loop(
    listener: TcpListener,
    tls_acceptor: Option<tokio_rustls::TlsAcceptor>,
    router: Router,
    room: Arc<Room>,
    mut shutdown_rx: watch::Receiver<Option<String>>,
) {
    let mut sweeper = tokio::time::interval(Duration::from_secs(5));
    sweeper.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        if shutdown_rx.borrow().is_some() {
            break;
        }
        tokio::select! {
            changed = shutdown_rx.changed() => {
                if changed.is_err() || shutdown_rx.borrow().is_some() {
                    break;
                }
            }
            _ = sweeper.tick() => {
                room.sweep_idle();
            }
            accepted = listener.accept() => {
                match accepted {
                    Ok((stream, peer)) => {
                        let router = router.clone();
                        let tls = tls_acceptor.clone();
                        tokio::spawn(async move {
                            let _ = stream.set_nodelay(true);
                            match tls {
                                Some(acceptor) => match acceptor.accept(stream).await {
                                    Ok(stream) => serve_connection(stream, peer, router).await,
                                    Err(_) => {}
                                },
                                None => serve_connection(stream, peer, router).await,
                            }
                        });
                    }
                    Err(error) => {
                        eprintln!("room listener error: {error}");
                        room.close("listener-error");
                        break;
                    }
                }
            }
        }
    }
    // 给正在写响应的连接一点时间；长轮询已经由 close() 用 410 唤醒。
    tokio::time::sleep(Duration::from_millis(25)).await;
}

async fn serve_connection<S>(stream: S, peer: SocketAddr, router: Router)
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let service = tower::service_fn(move |mut request: Request<Incoming>| {
        let router = router.clone();
        async move {
            request.extensions_mut().insert(ConnectInfo(peer));
            let (parts, body) = request.into_parts();
            let request = Request::from_parts(parts, Body::new(body));
            let response = router
                .oneshot(request)
                .await
                .unwrap_or_else(|_: Infallible| {
                    json_response(
                        StatusCode::INTERNAL_SERVER_ERROR,
                        &json!({ "ok": false, "reason": "server-error" }),
                    )
                });
            Ok::<_, Infallible>(response)
        }
    });
    let mut builder = http1::Builder::new();
    builder
        .timer(TokioTimer::new())
        .max_header_size(16 * 1024)
        .header_read_timeout(Duration::from_secs(20));
    let connection =
        builder.serve_connection(TokioIo::new(stream), TowerToHyperService::new(service));
    let _ = connection.await;
}

async fn handle_request(
    State(app): State<Arc<App>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    request: Request<Body>,
) -> Response {
    if let Err(error) = check_envelope(&app.room, &request) {
        return error_response(error);
    }
    if request.uri().scheme().is_some() || request.uri().authority().is_some() {
        return error_response(ApiError::new(404, "not-found"));
    }
    if request.method() != Method::POST {
        return error_response(ApiError::new(404, "not-found"));
    }
    let path = request.uri().path().to_string();
    match path.as_str() {
        "/v1/room/join" => join(app, peer, request).await,
        "/v1/room/state" => state(app, request).await,
        "/v1/room/update" => update(app, request).await,
        "/v1/room/care" => care(app, request).await,
        "/v1/room/care-result" => care_result(app, request).await,
        "/v1/room/game" => game(app, request).await,
        "/v1/room/leave" => leave(app, request).await,
        _ => error_response(ApiError::new(404, "not-found")),
    }
}

fn check_envelope(room: &Arc<Room>, request: &Request<Body>) -> Result<(), ApiError> {
    if room.is_closing() {
        return Err(ApiError::new(503, "room-closed"));
    }
    let headers = request.headers();
    let host_count = headers.get_all(header::HOST).iter().count();
    let origin_count = headers.get_all(header::ORIGIN).iter().count();
    let forwarded_count = headers.get_all("x-forwarded-host").iter().count();
    let forwarded_host = if room.trust_proxy() && forwarded_count == 1 {
        headers
            .get("x-forwarded-host")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
    } else {
        ""
    };
    let host = if forwarded_host.is_empty() {
        headers
            .get(header::HOST)
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
    } else {
        forwarded_host
    };
    if host_count != 1 || !room.check_host(&host.to_ascii_lowercase()) || origin_count != 0 {
        return Err(ApiError::new(403, "forbidden"));
    }
    let raw = request.uri().to_string();
    if raw.contains('?') || raw.contains('#') {
        return Err(ApiError::new(400, "query-not-allowed"));
    }
    Ok(())
}

async fn join(app: Arc<App>, peer: SocketAddr, request: Request<Body>) -> Response {
    if let Err(error) = app.room.check_join_rate(&peer.ip().to_string()) {
        return error_response(error);
    }
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    if !exact_keys(&input, &["clientId", "code", "profile"]) {
        return error_response(ApiError::new(400, "join-shape-invalid"));
    }
    let client_id = match normalize_client_id(input.get("clientId").unwrap_or(&Value::Null)) {
        Some(client_id) => client_id,
        None => return error_response(ApiError::new(400, "client-id-invalid")),
    };
    let code = match input.get("code") {
        Some(Value::String(code)) => code.clone(),
        _ => return error_response(ApiError::new(401, "room-code-invalid")),
    };
    let profile = input.get("profile").unwrap_or(&Value::Null);
    match app.room.join(client_id, &code, profile) {
        Ok(result) => {
            let mut body = match result.body {
                Value::Object(map) => map,
                _ => Map::new(),
            };
            body.insert("ok".to_string(), Value::Bool(true));
            body.insert("token".to_string(), Value::String(result.token));
            body.insert("playerId".to_string(), Value::String(result.player_id));
            json_response(StatusCode::OK, &Value::Object(body))
        }
        Err(error) => error_response(error),
    }
}

async fn state(app: Arc<App>, request: Request<Body>) -> Response {
    let token = match auth_token(&request) {
        Ok(token) => token,
        Err(error) => return error_response(error),
    };
    let player_id = match app.room.authenticate(&token) {
        Ok(player_id) => player_id,
        Err(error) => return error_response(error),
    };
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    if !exact_keys(&input, &["since"]) {
        return error_response(ApiError::new(400, "state-shape-invalid"));
    }
    let Some(since) = json_safe_integer(input.get("since").unwrap_or(&Value::Null)) else {
        return error_response(ApiError::new(400, "state-shape-invalid"));
    };
    match app.room.state(&player_id, since).await {
        Ok(StateOutcome::Body(body)) => json_response(StatusCode::OK, &body),
        Ok(StateOutcome::Closed(reason)) => {
            json_response(StatusCode::GONE, &json!({ "ok": false, "reason": reason }))
        }
        Err(error) => error_response(error),
    }
}

async fn update(app: Arc<App>, request: Request<Body>) -> Response {
    let token = match auth_token(&request) {
        Ok(token) => token,
        Err(error) => return error_response(error),
    };
    let player_id = match app.room.authenticate(&token) {
        Ok(player_id) => player_id,
        Err(error) => return error_response(error),
    };
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    match app.room.update(&player_id, &input) {
        Ok(body) => json_response(StatusCode::OK, &body),
        Err(error) => error_response(error),
    }
}

async fn care(app: Arc<App>, request: Request<Body>) -> Response {
    let token = match auth_token(&request) {
        Ok(token) => token,
        Err(error) => return error_response(error),
    };
    let player_id = match app.room.authenticate(&token) {
        Ok(player_id) => player_id,
        Err(error) => return error_response(error),
    };
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    match app.room.care(&player_id, &input) {
        Ok(body) => json_response(StatusCode::OK, &body),
        Err(error) => error_response(error),
    }
}

async fn care_result(app: Arc<App>, request: Request<Body>) -> Response {
    let token = match auth_token(&request) {
        Ok(token) => token,
        Err(error) => return error_response(error),
    };
    let player_id = match app.room.authenticate(&token) {
        Ok(player_id) => player_id,
        Err(error) => return error_response(error),
    };
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    match app.room.care_result(&player_id, &input) {
        Ok(body) => json_response(StatusCode::OK, &body),
        Err(error) => error_response(error),
    }
}

async fn game(app: Arc<App>, request: Request<Body>) -> Response {
    let token = match auth_token(&request) {
        Ok(token) => token,
        Err(error) => return error_response(error),
    };
    let player_id = match app.room.authenticate(&token) {
        Ok(player_id) => player_id,
        Err(error) => return error_response(error),
    };
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    let Some(authority) = app.authority.clone() else {
        return match app.room.game(&player_id, &input) {
            Ok(body) => json_response(StatusCode::OK, &body),
            Err(error) => error_response(error),
        };
    };
    let action = match app.room.check_game(&player_id, &input) {
        Ok(Some(action)) => action,
        Ok(None) => {
            let version = app.room.snapshot()["version"].clone();
            return json_response(
                StatusCode::OK,
                &json!({ "ok": true, "duplicate": true, "version": version }),
            );
        }
        Err(error) => return error_response(error),
    };
    let payload = json!({
        "room": app.room.code(),
        "from": player_id,
        "owner": app.room.is_owner(&player_id),
        "seq": action.seq,
        "ext": action.ext.clone(),
        "op": action.op.clone(),
        "data": action.data.clone(),
    });
    let response = authority
        .client
        .post(&authority.url)
        .header("x-room-authority", &authority.secret)
        .json(&payload)
        .send()
        .await;
    let body = match response {
        Ok(response) if response.status().is_success() => match response.json::<Value>().await {
            Ok(body) => body,
            Err(_) => return error_response(ApiError::new(502, "authority-bad-response")),
        },
        Ok(_) => return error_response(ApiError::new(400, "authority-rejected")),
        Err(_) => return error_response(ApiError::new(502, "authority-unavailable")),
    };
    if body.get("ok") != Some(&Value::Bool(true)) {
        return error_response(ApiError::new(400, "authority-rejected"));
    }
    let events = body
        .get("events")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if events.len() > 16 {
        return error_response(ApiError::new(502, "authority-bad-response"));
    }
    match app.room.accept_seq(&player_id, action.seq) {
        Ok(true) => {}
        Ok(false) => {
            let version = app.room.snapshot()["version"].clone();
            return json_response(
                StatusCode::OK,
                &json!({ "ok": true, "duplicate": true, "version": version }),
            );
        }
        Err(error) => return error_response(error),
    }
    let mut last = json!({ "ok": true, "version": app.room.snapshot()["version"].clone() });
    for event in events {
        let from = event
            .get("from")
            .and_then(Value::as_str)
            .unwrap_or("authority");
        let ext = event
            .get("ext")
            .and_then(Value::as_str)
            .unwrap_or(&action.ext);
        let op = event.get("op").and_then(Value::as_str).unwrap_or("event");
        let data = event.get("data").cloned().unwrap_or_else(|| json!({}));
        match app.room.append_authority(from, ext, op, data) {
            Ok(value) => last = value,
            Err(error) => return error_response(error),
        }
    }
    json_response(StatusCode::OK, &last)
}

async fn leave(app: Arc<App>, request: Request<Body>) -> Response {
    let token = match auth_token(&request) {
        Ok(token) => token,
        Err(error) => return error_response(error),
    };
    let player_id = match app.room.authenticate(&token) {
        Ok(player_id) => player_id,
        Err(error) => return error_response(error),
    };
    let input = match read_json(request).await {
        Ok(input) => input,
        Err(error) => return error_response(error),
    };
    if !exact_keys(&input, &[]) {
        return error_response(ApiError::new(400, "leave-shape-invalid"));
    }
    match app.room.leave(&player_id) {
        Ok(body) => json_response(StatusCode::OK, &body),
        Err(error) => error_response(error),
    }
}

fn auth_token(request: &Request<Body>) -> Result<String, ApiError> {
    let values: Vec<_> = request
        .headers()
        .get_all(header::AUTHORIZATION)
        .iter()
        .collect();
    if values.len() != 1 {
        return Err(ApiError::new(401, "unauthorized"));
    }
    let Ok(value) = values[0].to_str() else {
        return Err(ApiError::new(401, "unauthorized"));
    };
    let Some(token) = value.strip_prefix("Bearer ") else {
        return Err(ApiError::new(401, "unauthorized"));
    };
    if token.len() != 64
        || !token
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(ApiError::new(401, "unauthorized"));
    }
    Ok(token.to_string())
}

async fn read_json(request: Request<Body>) -> Result<Value, ApiError> {
    let content_types = request
        .headers()
        .get_all(header::CONTENT_TYPE)
        .iter()
        .count();
    if content_types != 1 {
        return Err(ApiError::new(415, "json-required"));
    }
    let content_type = request
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");
    if !json_content_type(content_type) {
        return Err(ApiError::new(415, "json-required"));
    }
    // 和 Node 的 server.requestTimeout 对齐：慢速滴 body 不能在公网无限占连接。
    let bytes = tokio::time::timeout(
        Duration::from_secs(20),
        to_bytes(request.into_body(), ROOM_MAX_BODY),
    )
    .await
    .map_err(|_| ApiError::new(408, "request-timeout"))?
    .map_err(|_| ApiError::new(413, "body-too-large"))?;
    let text = String::from_utf8_lossy(&bytes);
    let value: Value =
        serde_json::from_str(&text).map_err(|_| ApiError::new(400, "invalid-json"))?;
    if !value.is_object() {
        return Err(ApiError::new(400, "invalid-json"));
    }
    Ok(value)
}

fn json_content_type(value: &str) -> bool {
    let lowered = value.trim().to_ascii_lowercase();
    if lowered == "application/json" {
        return true;
    }
    let Some(rest) = lowered.strip_prefix("application/json") else {
        return false;
    };
    let rest = rest.trim_start_matches(char::is_whitespace);
    let Some(rest) = rest.strip_prefix(';') else {
        return false;
    };
    rest.trim_start_matches(char::is_whitespace) == "charset=utf-8"
}

fn json_response(status: StatusCode, value: &Value) -> Response {
    let body = serde_json::to_vec(value)
        .unwrap_or_else(|_| br#"{"ok":false,"reason":"server-error"}"#.to_vec());
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-store")
        .header("x-content-type-options", "nosniff")
        .body(Body::from(body))
        .unwrap_or_else(|_| Response::new(Body::empty()))
}

fn error_response(error: ApiError) -> Response {
    json_response(
        StatusCode::from_u16(error.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
        &json!({ "ok": false, "reason": error.reason }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_type_matches_node_regex() {
        for value in [
            "application/json",
            "APPLICATION/JSON",
            "application/json; charset=utf-8",
            "application/json;charset=utf-8",
            "application/json ; charset=utf-8",
        ] {
            assert!(json_content_type(value), "{value}");
        }
        for value in [
            "",
            "text/plain",
            "application/json;",
            "application/json; charset=latin1",
            "application/json; charset=utf-8; x=1",
        ] {
            assert!(!json_content_type(value), "{value}");
        }
    }

    #[test]
    fn address_kinds_match_node() {
        assert_eq!(address_kind(Ipv4Addr::new(127, 0, 0, 1)), "loopback");
        assert_eq!(address_kind(Ipv4Addr::new(10, 1, 2, 3)), "private");
        assert_eq!(address_kind(Ipv4Addr::new(172, 16, 0, 1)), "private");
        assert_eq!(address_kind(Ipv4Addr::new(172, 32, 0, 1)), "public");
        assert_eq!(address_kind(Ipv4Addr::new(192, 168, 1, 1)), "private");
        assert_eq!(address_kind(Ipv4Addr::new(169, 254, 1, 1)), "link-local");
        assert_eq!(address_kind(Ipv4Addr::new(8, 8, 8, 8)), "public");
    }
}
