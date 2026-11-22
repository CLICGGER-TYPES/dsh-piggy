use std::sync::Arc;
use std::time::Duration;

use dsh_piggy_room_server::tls::TlsMaterials;
use dsh_piggy_room_server::{start_server, ServerHandle, ServerOptions};
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio_rustls::TlsConnector;

const CODE: &str = "7K2M";

struct TestServer {
    base: String,
    port: u16,
    handle: ServerHandle,
    client: reqwest::Client,
}

impl TestServer {
    async fn start(options: ServerOptions) -> Self {
        let handle = start_server(options).await.expect("room server starts");
        let port = handle.port();
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(25))
            .build()
            .expect("client");
        Self {
            base: format!("http://127.0.0.1:{port}"),
            port,
            handle,
            client,
        }
    }

    async fn start_default() -> Self {
        Self::start(ServerOptions::default()).await
    }

    async fn post(&self, path: &str, body: &Value) -> (u16, Value) {
        let response = self
            .client
            .post(format!("{}{}", self.base, path))
            .json(body)
            .send()
            .await
            .expect("request");
        let status = response.status().as_u16();
        let body = response.json().await.expect("json response");
        (status, body)
    }

    async fn post_auth(&self, path: &str, token: &str, body: &Value) -> (u16, Value) {
        let response = self
            .client
            .post(format!("{}{}", self.base, path))
            .header("authorization", format!("Bearer {token}"))
            .json(body)
            .send()
            .await
            .expect("request");
        let status = response.status().as_u16();
        let body = response.json().await.expect("json response");
        (status, body)
    }

    async fn join(&self, client_id: &str, name: &str) -> (u16, Value) {
        self.post(
            "/v1/room/join",
            &json!({
                "clientId": client_id,
                "code": CODE,
                "profile": profile(name),
            }),
        )
        .await
    }

    async fn close(self) {
        self.handle.close().await;
    }
}

fn profile(name: &str) -> Value {
    json!({
        "name": name,
        "level": 12,
        "stage": "piglet",
        "art": "",
        "emoji": "🐖",
        "size": 1,
        "label": "",
        "care": { "satiety": 70, "cleanliness": 80, "happiness": 90 },
        "actions": {
            "feed": { "ready": true, "waitSeconds": 0, "blocked": null },
            "bathe": { "ready": true, "waitSeconds": 0, "blocked": null },
            "play": { "ready": true, "waitSeconds": 0, "blocked": null },
            "pet": { "ready": true, "waitSeconds": 0, "blocked": null }
        },
        "mood": "happy",
        "moodLabel": "开心",
        "status": {
            "level": { "level": 12, "percent": 10, "toNext": 90, "maxed": false, "titleEmoji": "", "titleLabel": "" },
            "health": 5, "healthPercent": 100, "maxHealth": 5,
            "traits": { "intel": 1, "charm": 1, "strong": 1 },
            "weight": "",
            "bodyWeight": null,
            "mood": "happy", "moodLabel": "开心",
            "illness": null
        },
        "card": {
            "birthday": "", "zodiac": null, "personality": null,
            "catchphrase": "", "motto": "", "counts": null
        }
    })
}

fn token_of(body: &Value) -> String {
    body["token"].as_str().expect("token").to_string()
}

fn player_id_of(body: &Value) -> String {
    body["playerId"].as_str().expect("playerId").to_string()
}

fn version_of(body: &Value) -> u64 {
    body["version"].as_u64().expect("version")
}

fn assert_error(body: &Value, reason: &str) {
    assert_eq!(body["ok"], false);
    assert_eq!(body["reason"], reason);
}

async fn raw_request(port: u16, request: String) -> (u16, String) {
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .await
        .expect("connect");
    stream
        .write_all(request.as_bytes())
        .await
        .expect("write request");
    let mut buffer = Vec::new();
    tokio::time::timeout(Duration::from_secs(5), stream.read_to_end(&mut buffer))
        .await
        .expect("response timeout")
        .expect("read response");
    let text = String::from_utf8_lossy(&buffer).to_string();
    parse_http_response(&text)
}

fn raw_json_request(port: u16, extra_headers: &str, body: &str) -> String {
    format!(
        "POST /v1/room/join HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nContent-Type: application/json\r\n{extra_headers}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn parse_http_response(text: &str) -> (u16, String) {
    let status = text
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|value| value.parse::<u16>().ok())
        .expect("status line");
    let body = text
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.to_string())
        .unwrap_or_default();
    (status, body)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn join_state_update_care_leave_flow() {
    let server = TestServer::start_default().await;
    let (status, joined_a) = server.join("flow-a", "甲").await;
    assert_eq!(status, 200);
    assert_eq!(joined_a["ok"], true);
    let token_a = token_of(&joined_a);
    assert_eq!(token_a.len(), 64);
    assert!(token_a
        .bytes()
        .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)));
    let id_a = player_id_of(&joined_a);
    let version = version_of(&joined_a);
    assert!(version >= 2);
    assert_eq!(joined_a["room"]["code"], CODE);
    assert_eq!(joined_a["room"]["hostId"], Value::Null);
    assert_eq!(joined_a["players"].as_array().unwrap().len(), 1);
    assert_eq!(joined_a["players"][0]["id"], id_a);
    assert_eq!(joined_a["players"][0]["host"], false);
    assert_eq!(joined_a["players"][0]["name"], "甲");
    assert_eq!(joined_a["careEvents"].as_array().unwrap().len(), 0);
    assert_eq!(joined_a["careResults"].as_array().unwrap().len(), 0);

    let (status, state) = server
        .post_auth("/v1/room/state", &token_a, &json!({ "since": version - 1 }))
        .await;
    assert_eq!(status, 200);
    assert_eq!(state["version"], version);

    let (status, updated) = server
        .post_auth(
            "/v1/room/update",
            &token_a,
            &json!({ "rev": 1, "x": 0.2, "y": 0.3, "facing": -1, "emote": "wave", "targetId": "" }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(updated["ok"], true);
    let update_version = version_of(&updated);
    assert!(update_version > version);

    let (status, state) = server
        .post_auth(
            "/v1/room/state",
            &token_a,
            &json!({ "since": update_version - 1 }),
        )
        .await;
    assert_eq!(status, 200);
    let player = &state["players"][0];
    assert_eq!(player["x"], 0.2);
    assert_eq!(player["y"], 0.3);
    assert_eq!(player["facing"], -1);
    assert_eq!(player["emote"], "wave");
    assert_eq!(player["emoteTarget"], id_a);
    assert!(player["emoteAt"].as_u64().unwrap() > 0);

    let (status, joined_b) = server.join("flow-b", "乙").await;
    assert_eq!(status, 200);
    let token_b = token_of(&joined_b);
    let id_b = player_id_of(&joined_b);
    let version = version_of(&joined_b);
    let players = joined_b["players"].as_array().unwrap();
    assert_eq!(players.len(), 2);
    assert_eq!(players[0]["id"], id_a);
    assert_eq!(players[1]["id"], id_b);
    assert_eq!(players[1]["x"], 0.66);
    assert_eq!(players[1]["row"], 1);

    let (status, care) = server
        .post_auth(
            "/v1/room/care",
            &token_a,
            &json!({ "targetId": id_b, "itemKey": "apple-1", "op": "feed", "nonce": "n-1" }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(care["ok"], true);
    assert!(care["eventId"].as_str().unwrap().len() >= 32);

    let (status, state) = server
        .post_auth("/v1/room/state", &token_a, &json!({ "since": version - 1 }))
        .await;
    assert_eq!(status, 200);
    assert_eq!(state["careEvents"].as_array().unwrap().len(), 1);
    assert_eq!(state["careEvents"][0]["from"], id_a);
    assert_eq!(state["careEvents"][0]["targetId"], id_b);
    assert_eq!(state["careEvents"][0]["itemKey"], "apple-1");
    assert_eq!(state["careEvents"][0]["nonce"], "n-1");

    let (status, result) = server
        .post_auth(
            "/v1/room/care-result",
            &token_b,
            &json!({
                "targetId": id_b, "nonce": "n-1", "ok": true, "reason": "",
                "care": { "satiety": 10, "cleanliness": 20, "happiness": 30 }
            }),
        )
        .await;
    assert_eq!(status, 200);
    let result_version = version_of(&result);
    let (status, state) = server
        .post_auth(
            "/v1/room/state",
            &token_b,
            &json!({ "since": result_version - 1 }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(state["careResults"].as_array().unwrap().len(), 1);
    assert_eq!(state["careResults"][0]["targetId"], id_b);
    assert_eq!(state["careResults"][0]["ok"], true);
    assert_eq!(state["players"][1]["care"]["satiety"], 10);

    let (status, left) = server
        .post_auth("/v1/room/leave", &token_a, &json!({}))
        .await;
    assert_eq!(status, 200);
    assert_eq!(left, json!({ "ok": true }));
    let (status, gone) = server
        .post_auth("/v1/room/state", &token_a, &json!({ "since": 0 }))
        .await;
    assert_eq!(status, 401);
    assert_error(&gone, "unauthorized");
    assert_eq!(server.handle.room().player_count(), 1);

    let (status, _) = server
        .post_auth("/v1/room/leave", &token_b, &json!({}))
        .await;
    assert_eq!(status, 200);
    server.close().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn long_poll_is_woken_by_the_next_bump() {
    let server = TestServer::start_default().await;
    let (_, joined) = server.join("poll-a", "甲").await;
    let token = token_of(&joined);
    let since = version_of(&joined);

    let started = std::time::Instant::now();
    let poll = tokio::spawn({
        let client = server.client.clone();
        let url = format!("{}/v1/room/state", server.base);
        let token = token.clone();
        async move {
            let response = client
                .post(url)
                .header("authorization", format!("Bearer {token}"))
                .json(&json!({ "since": since }))
                .send()
                .await
                .expect("poll request");
            let status = response.status().as_u16();
            let body = response.json::<Value>().await.expect("poll body");
            (status, body)
        }
    });
    tokio::time::sleep(Duration::from_millis(250)).await;
    let (status, _) = server.join("poll-b", "乙").await;
    assert_eq!(status, 200);

    let (status, body) = tokio::time::timeout(Duration::from_secs(5), poll)
        .await
        .expect("long poll should wake")
        .expect("poll task");
    assert_eq!(status, 200);
    assert!(version_of(&body) > since);
    assert_eq!(body["players"].as_array().unwrap().len(), 2);
    assert!(
        started.elapsed() >= Duration::from_millis(250),
        "poll returned before the bump"
    );
    assert!(started.elapsed() < Duration::from_secs(5));
    server.close().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn authentication_host_origin_and_shape_errors() {
    let server = TestServer::start_default().await;
    let (status, joined) = server.join("errors-a", "甲").await;
    assert_eq!(status, 200);
    let token = token_of(&joined);
    let id = player_id_of(&joined);
    let version = version_of(&joined);

    let response = server
        .client
        .post(format!("{}/v1/room/state", server.base))
        .json(&json!({ "since": 0 }))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 401);
    assert_error(&response.json().await.unwrap(), "unauthorized");

    let response = server
        .client
        .post(format!("{}/v1/room/state", server.base))
        .header("authorization", "Bearer not-a-token")
        .json(&json!({ "since": 0 }))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 401);

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .body("{}")
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 415);
    assert_error(&response.json().await.unwrap(), "json-required");

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .header("content-type", "text/plain")
        .body("{}")
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 415);

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .header("content-type", "application/json")
        .body("not json")
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 400);
    assert_error(&response.json().await.unwrap(), "invalid-json");

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .json(&json!({ "clientId": "x", "code": CODE }))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 400);
    assert_error(&response.json().await.unwrap(), "join-shape-invalid");

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .json(&json!({ "clientId": "bad id", "code": CODE, "profile": profile("x") }))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 400);
    assert_error(&response.json().await.unwrap(), "client-id-invalid");

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .json(&json!({ "clientId": "wrong-code", "code": "AAAA", "profile": profile("x") }))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 401);
    assert_error(&response.json().await.unwrap(), "room-code-invalid");

    let (status, duplicate) = server.join("errors-a", "甲").await;
    assert_eq!(status, 409);
    assert_error(&duplicate, "client-already-joined");

    let response = server
        .client
        .post(format!("{}/v1/room/join", server.base))
        .header("content-type", "application/json")
        .body(format!("{{\"pad\":\"{}\"}}", "x".repeat(5000)))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 413);
    assert_error(&response.json().await.unwrap(), "body-too-large");

    let response = server
        .client
        .get(format!("{}/v1/room/state", server.base))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 404);

    let response = server
        .client
        .post(format!("{}/v1/room/nope", server.base))
        .json(&json!({}))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 404);
    assert_error(&response.json().await.unwrap(), "not-found");

    let response = server
        .client
        .post(format!("{}/v1/room/join?x=1", server.base))
        .json(&json!({}))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 400);
    assert_error(&response.json().await.unwrap(), "query-not-allowed");

    let response = server
        .client
        .post(format!("{}/v1/room/state", server.base))
        .header("authorization", format!("Bearer {token}"))
        .header("origin", "http://evil.example")
        .json(&json!({ "since": 0 }))
        .send()
        .await
        .expect("request");
    assert_eq!(response.status().as_u16(), 403);
    assert_error(&response.json().await.unwrap(), "forbidden");

    let (status, body) = server
        .post_auth("/v1/room/state", &token, &json!({ "since": "0" }))
        .await;
    assert_eq!(status, 400);
    assert_error(&body, "state-shape-invalid");

    let (status, body) = server
        .post_auth(
            "/v1/room/update",
            &token,
            &json!({ "rev": 1, "x": "bad", "y": 0, "facing": 1, "emote": "", "targetId": "" }),
        )
        .await;
    assert_eq!(status, 500);
    assert_error(&body, "server-error");

    let (status, body) = server
        .post_auth(
            "/v1/room/update",
            &token,
            &json!({ "rev": 1, "x": 0.5, "y": 0.2, "facing": 1, "emote": "wave", "targetId": "missing" }),
        )
        .await;
    assert_eq!(status, 400);
    assert_error(&body, "emote-target-invalid");

    let (status, body) = server
        .post_auth(
            "/v1/room/care",
            &token,
            &json!({ "targetId": "missing", "itemKey": "apple", "op": "feed", "nonce": "n" }),
        )
        .await;
    assert_eq!(status, 404);
    assert_error(&body, "care-target-missing");

    let (status, body) = server
        .post_auth("/v1/room/leave", &token, &json!({ "x": 1 }))
        .await;
    assert_eq!(status, 400);
    assert_error(&body, "leave-shape-invalid");

    let raw = raw_json_request(
        server.port,
        "",
        &serde_json::to_string(&json!({
            "clientId": "raw-host",
            "code": CODE,
            "profile": profile("raw"),
        }))
        .unwrap(),
    )
    .replace(
        &format!("Host: 127.0.0.1:{}", server.port),
        "Host: evil.example",
    );
    let (status, body) = raw_request(server.port, raw).await;
    assert_eq!(status, 403);
    assert!(body.contains("forbidden"));

    let (status, body) = raw_request(
        server.port,
        format!(
            "POST /v1/room/join HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}",
            server.port
        ),
    )
    .await;
    assert_eq!(status, 415);
    assert!(body.contains("json-required"));

    let (status, body) = raw_request(
        server.port,
        {
            let body = "{\"since\":0}";
            format!(
                "POST /v1/room/state HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAuthorization: Bearer {}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                server.port,
                token,
                token,
                body.len(),
                body
            )
        },
    )
    .await;
    assert_eq!(status, 401);
    assert!(body.contains("unauthorized"));

    assert!(version >= 2);
    assert!(!id.is_empty());
    server.close().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn join_rate_limit_returns_429() {
    let server = TestServer::start_default().await;
    let mut statuses = Vec::new();
    for index in 0..21 {
        let (status, body) = server
            .post(
                "/v1/room/join",
                &json!({
                    "clientId": format!("rate-{index}"),
                    "code": "AAAA",
                    "profile": profile("x"),
                }),
            )
            .await;
        statuses.push((status, body));
    }
    for (status, body) in &statuses[..20] {
        assert_eq!(*status, 401);
        assert_error(body, "room-code-invalid");
    }
    assert_eq!(statuses[20].0, 429);
    assert_error(&statuses[20].1, "join-rate-limited");
    server.close().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn room_full_returns_429() {
    let server = TestServer::start(ServerOptions {
        join_limit: None,
        ..Default::default()
    })
    .await;
    for index in 0..32 {
        let (status, body) = server
            .join(&format!("full-{index}"), &format!("猪{index}"))
            .await;
        assert_eq!(status, 200, "join {index}: {body}");
    }
    let (status, body) = server.join("full-32", "猪32").await;
    assert_eq!(status, 429);
    assert_error(&body, "room-full");
    assert_eq!(server.handle.room().player_count(), 32);
    server.close().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn no_persistent_host_leave_closes_polls_with_410() {
    let server = TestServer::start(ServerOptions {
        persistent: false,
        ..Default::default()
    })
    .await;
    let (status, joined) = server.join("host-a", "房主").await;
    assert_eq!(status, 200);
    assert_eq!(joined["players"][0]["host"], true);
    assert_eq!(joined["room"]["hostId"], player_id_of(&joined));
    let token = token_of(&joined);
    let since = version_of(&joined);

    let poll = tokio::spawn({
        let client = server.client.clone();
        let url = format!("{}/v1/room/state", server.base);
        let token = token.clone();
        async move {
            let response = client
                .post(url)
                .header("authorization", format!("Bearer {token}"))
                .json(&json!({ "since": since }))
                .send()
                .await
                .expect("poll request");
            (
                response.status().as_u16(),
                response.json::<Value>().await.expect("body"),
            )
        }
    });
    tokio::time::sleep(Duration::from_millis(250)).await;
    let (status, _) = server.post_auth("/v1/room/leave", &token, &json!({})).await;
    assert_eq!(status, 200);

    let (status, body) = tokio::time::timeout(Duration::from_secs(5), poll)
        .await
        .expect("poll should be woken by close")
        .expect("poll task");
    assert_eq!(status, 410);
    assert_error(&body, "host-left");
    server.close().await;
}

#[derive(Debug)]
struct AcceptAnyCertificate;

impl ServerCertVerifier for AcceptAnyCertificate {
    fn verify_server_cert(
        &self,
        _end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &CertificateDer<'_>,
        _dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        Ok(HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        rustls::crypto::ring::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

async fn https_request(port: u16, request: String) -> (u16, String) {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let mut config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .expect("protocol versions")
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(AcceptAnyCertificate))
        .with_no_client_auth();
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    let connector = TlsConnector::from(Arc::new(config));
    let stream = TcpStream::connect(("127.0.0.1", port))
        .await
        .expect("tcp connect");
    let name = ServerName::try_from("127.0.0.1").expect("server name");
    let mut stream = connector
        .connect(name, stream)
        .await
        .expect("tls handshake");
    stream
        .write_all(request.as_bytes())
        .await
        .expect("write request");
    let mut buffer = Vec::new();
    tokio::time::timeout(Duration::from_secs(5), stream.read_to_end(&mut buffer))
        .await
        .expect("response timeout")
        .expect("read response");
    parse_http_response(&String::from_utf8_lossy(&buffer))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn direct_https_serves_join_state_and_leave() {
    let server = TestServer::start(ServerOptions {
        tls: Some(TlsMaterials {
            cert_pem: include_bytes!("fixtures/test-only.crt").to_vec(),
            key_pem: include_bytes!("fixtures/test-only.key").to_vec(),
        }),
        ..Default::default()
    })
    .await;
    let join_body = serde_json::to_string(&json!({
        "clientId": "tls-integration",
        "code": CODE,
        "profile": profile("TLS"),
    }))
    .unwrap();
    let (status, response) = https_request(
        server.port,
        format!(
            "POST /v1/room/join HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            server.port,
            join_body.len(),
            join_body
        ),
    )
    .await;
    assert_eq!(status, 200, "{response}");
    let joined: Value = serde_json::from_str(&response).expect("join json");
    let token = token_of(&joined);
    let version = version_of(&joined);

    let state_body = format!("{{\"since\":{}}}", version - 1);
    let (status, response) = https_request(
        server.port,
        format!(
            "POST /v1/room/state HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            server.port,
            token,
            state_body.len(),
            state_body
        ),
    )
    .await;
    assert_eq!(status, 200, "{response}");
    let state: Value = serde_json::from_str(&response).expect("state json");
    assert_eq!(state["players"].as_array().unwrap().len(), 1);

    let (status, response) = https_request(
        server.port,
        format!(
            "POST /v1/room/leave HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{{}}",
            server.port, token
        ),
    )
    .await;
    assert_eq!(status, 200, "{response}");
    server.close().await;
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn trust_proxy_uses_forwarded_host_only_when_enabled() {
    let server = TestServer::start(ServerOptions {
        advertised_host: "piggy.example.com".to_string(),
        advertised_port: Some(443),
        trust_proxy: true,
        ..Default::default()
    })
    .await;
    let body = serde_json::to_string(&json!({
        "clientId": "proxy-a",
        "code": CODE,
        "profile": profile("代理"),
    }))
    .unwrap();
    let request = format!(
        "POST /v1/room/join HTTP/1.1\r\nHost: evil.example\r\nX-Forwarded-Host: piggy.example.com\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let (status, response) = raw_request(server.port, request).await;
    assert_eq!(status, 200, "{response}");
    server.close().await;

    let server = TestServer::start(ServerOptions {
        advertised_host: "piggy.example.com".to_string(),
        advertised_port: Some(443),
        trust_proxy: false,
        ..Default::default()
    })
    .await;
    let (status, response) = raw_request(
        server.port,
        format!(
            "POST /v1/room/join HTTP/1.1\r\nHost: evil.example\r\nX-Forwarded-Host: piggy.example.com\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        ),
    )
    .await;
    assert_eq!(status, 403, "{response}");
    server.close().await;
}

#[tokio::test]
async fn game_events_flow_and_limits() {
    let server = TestServer::start_default().await;
    let (status, host) = server.join("client-host", "猪猪").await;
    assert_eq!(status, 200);
    let (status, guest) = server.join("client-guest", "团子").await;
    assert_eq!(status, 200);
    assert_eq!(guest["room"]["caps"], json!(["game"]));
    assert_eq!(guest["room"]["authority"], json!("host"));
    let host_token = host["token"].as_str().expect("host token");
    let guest_token = guest["token"].as_str().expect("guest token");
    let host_id = host["playerId"].as_str().expect("host id");
    let guest_id = guest["playerId"].as_str().expect("guest id");

    let (status, sent) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 1, "ext": "roulette", "op": "action", "data": { "op": "arm", "from": host_id } }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(sent["ok"], true);
    assert!(sent["eventId"].as_u64().is_some());

    let (status, state) = server
        .post_auth("/v1/room/state", host_token, &json!({ "since": 0 }))
        .await;
    assert_eq!(status, 200);
    let events = state["gameEvents"].as_array().expect("game events");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["from"], json!(guest_id));
    assert_eq!(events[0]["ext"], json!("roulette"));
    assert_eq!(events[0]["data"]["from"], json!(host_id));

    let (status, duplicate) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 1, "ext": "roulette", "op": "action", "data": {} }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(duplicate["duplicate"], true);

    let (status, _) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 0, "ext": "roulette", "op": "action", "data": {} }),
        )
        .await;
    assert_eq!(status, 400);
    let (status, _) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 2, "ext": "Roulette!", "op": "action", "data": {} }),
        )
        .await;
    assert_eq!(status, 400);
    let big = json!({ "text": "x".repeat(1600) });
    let (status, _) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 2, "ext": "roulette", "op": "action", "data": big }),
        )
        .await;
    assert_eq!(status, 400);
    let oversized: serde_json::Map<String, Value> = (0..10)
        .map(|index| (format!("k{index}"), json!("x".repeat(200))))
        .collect();
    let (status, _) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 2, "ext": "roulette", "op": "action", "data": oversized }),
        )
        .await;
    assert_eq!(status, 413);

    let mut limited = false;
    for seq in 2..24 {
        let (status, _) = server
            .post_auth(
                "/v1/room/game",
                guest_token,
                &json!({ "seq": seq, "ext": "roulette", "op": "action", "data": {} }),
            )
            .await;
        if status == 429 {
            limited = true;
            break;
        }
    }
    assert!(limited);
    server.close().await;
}

#[tokio::test]
async fn authority_mode_forwards_actions_and_broadcasts_events() {
    use axum::extract::Json;
    use axum::http::HeaderMap;
    use axum::routing::post;

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("authority listener");
    let address = listener.local_addr().expect("authority address");
    let app = axum::Router::new().route(
        "/v1/game",
        post(|headers: HeaderMap, Json(body): Json<Value>| async move {
            assert_eq!(
                headers.get("x-room-authority").and_then(|value| value.to_str().ok()),
                Some("test-secret-0123456789")
            );
            assert_eq!(body["ext"], json!("roulette"));
            let owner = body["owner"].clone();
            Json(json!({
                "ok": true,
                "events": [
                    { "from": "authority", "ext": "roulette", "op": "snapshot", "data": { "rev": 7, "stage": "choice", "owner": owner } }
                ]
            }))
        }),
    );
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    let mut options = ServerOptions::default();
    options.authority_url = Some(format!("http://{address}/v1/game"));
    options.authority_secret = Some("test-secret-0123456789".to_string());
    let server = TestServer::start(options).await;
    let (status, host) = server.join("client-host", "猪猪").await;
    assert_eq!(status, 200);
    assert_eq!(host["room"]["authority"], json!("server"));
    let token = host["token"].as_str().expect("token");

    let (status, body) = server
        .post_auth(
            "/v1/room/game",
            token,
            &json!({ "seq": 1, "ext": "roulette", "op": "action", "data": { "op": "arm" } }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(body["ok"], true);
    let (status, state) = server
        .post_auth("/v1/room/state", token, &json!({ "since": 0 }))
        .await;
    assert_eq!(status, 200);
    let events = state["gameEvents"].as_array().expect("events");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["from"], json!("authority"));
    assert_eq!(events[0]["op"], json!("snapshot"));
    assert_eq!(events[0]["data"]["rev"], json!(7));
    assert_eq!(
        events[0]["data"]["owner"],
        json!(true),
        "第一位玩家是创建者"
    );

    let (status, guest) = server.join("client-guest", "客猪").await;
    assert_eq!(status, 200);
    let guest_token = guest["token"].as_str().expect("guest token");
    let (status, _) = server
        .post_auth(
            "/v1/room/game",
            guest_token,
            &json!({ "seq": 1, "ext": "roulette", "op": "action", "data": { "op": "arm" } }),
        )
        .await;
    assert_eq!(status, 200);
    let (status, state) = server
        .post_auth("/v1/room/state", token, &json!({ "since": 0 }))
        .await;
    assert_eq!(status, 200);
    let events = state["gameEvents"].as_array().expect("events");
    assert_eq!(
        events.last().expect("guest event")["data"]["owner"],
        json!(false),
        "后加入的玩家不是创建者"
    );

    let (status, duplicate) = server
        .post_auth(
            "/v1/room/game",
            token,
            &json!({ "seq": 1, "ext": "roulette", "op": "action", "data": {} }),
        )
        .await;
    assert_eq!(status, 200);
    assert_eq!(duplicate["duplicate"], true);
    server.close().await;
}
