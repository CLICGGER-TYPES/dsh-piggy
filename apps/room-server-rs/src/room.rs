//! 内存房间状态、令牌、长轮询、照顾事件与清理。

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rand::rngs::OsRng;
use rand::RngCore;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use tokio::sync::{oneshot, watch};

use crate::protocol::{
    care_stats_json, exact_keys, normalize_care_intent, normalize_care_stats, normalize_emote,
    normalize_position, normalize_profile, profile_json, truncate_utf16, valid_room_host,
    CareIntent, CareStats, Profile, ROOM_MAX_PLAYERS,
};
use crate::room_code::normalize_room_code;
use crate::util::{iso8601_now, json_number, json_safe_integer, now_ms, random_uuid_v4};

pub const ROOM_STATE_HOLD: Duration = Duration::from_secs(15);
pub const ROOM_IDLE: Duration = Duration::from_millis(30_000);
pub const MAX_JOIN_WINDOW: Duration = Duration::from_secs(60);
pub const MAX_JOIN_ATTEMPTS: u32 = 20;
pub const ROOM_GAME_MAX_DATA: usize = 1536;
pub const ROOM_GAME_RATE_WINDOW: Duration = Duration::from_secs(1);
pub const ROOM_GAME_RATE_LIMIT: u32 = 20;

fn valid_game_key(value: &str, op: bool) -> bool {
    let bytes = value.as_bytes();
    if bytes.is_empty() || bytes.len() > 32 {
        return false;
    }
    if op && !bytes[0].is_ascii_lowercase() {
        return false;
    }
    bytes.iter().enumerate().all(|(index, byte)| {
        byte.is_ascii_lowercase()
            || byte.is_ascii_digit()
            || (*byte == b'-' && (!op || index > 0))
    })
}

fn valid_game_value(value: &Value, depth: usize) -> bool {
    if depth > 4 {
        return false;
    }
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => true,
        Value::String(text) => text.len() <= 256,
        Value::Array(items) => items.len() <= 32 && items.iter().all(|item| valid_game_value(item, depth + 1)),
        Value::Object(map) => {
            map.len() <= 32
                && map
                    .iter()
                    .all(|(key, item)| key.len() <= 32 && valid_game_value(item, depth + 1))
        }
    }
}

fn append_game_locked(
    inner: &mut Inner,
    from: String,
    ext: &str,
    op: &str,
    data: Value,
    at: u64,
) -> u64 {
    let id = inner.next_game_event_id;
    inner.next_game_event_id += 1;
    inner.game_events.push_back(GameEvent {
        id,
        from,
        ext: ext.to_string(),
        op: op.to_string(),
        data,
        at,
    });
    while inner.game_events.len() > 32 {
        inner.game_events.pop_front();
    }
    id
}

#[derive(Debug, Clone, Copy)]
pub struct ApiError {
    pub status: u16,
    pub reason: &'static str,
}

impl ApiError {
    pub const fn new(status: u16, reason: &'static str) -> Self {
        Self { status, reason }
    }
}

#[derive(Debug, Clone)]
pub struct JoinLimit {
    pub max: u32,
    pub window: Duration,
}

impl Default for JoinLimit {
    fn default() -> Self {
        Self {
            max: MAX_JOIN_ATTEMPTS,
            window: MAX_JOIN_WINDOW,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RoomOptions {
    pub code: String,
    pub advertised_host: String,
    pub advertised_port: Option<u16>,
    pub actual_port: u16,
    pub persistent: bool,
    pub trust_proxy: bool,
    pub authority: bool,
    pub join_limit: Option<JoinLimit>,
    pub log: bool,
}

#[derive(Debug, Clone)]
pub struct Player {
    pub key: [u8; 32],
    pub id: String,
    pub client_id: String,
    pub profile: Profile,
    pub x: f64,
    pub y: f64,
    pub row: i64,
    pub facing: i64,
    pub emote: String,
    pub emote_target: Option<String>,
    pub emote_at: u64,
    pub host: bool,
    pub joined_at: u64,
    pub last_seen_at: u64,
    pub rev: u64,
    pub game_seq: u64,
    pub game_window: Option<(Instant, u32)>,
}

#[derive(Debug, Clone)]
pub struct GameEvent {
    pub id: u64,
    pub from: String,
    pub ext: String,
    pub op: String,
    pub data: Value,
    pub at: u64,
}

#[derive(Debug, Clone)]
pub struct GameAction {
    pub seq: u64,
    pub ext: String,
    pub op: String,
    pub data: Value,
}

#[derive(Debug, Clone)]
pub struct CareEvent {
    pub id: String,
    pub from: String,
    pub target_id: String,
    pub item_key: String,
    pub op: String,
    pub nonce: String,
    pub at: u64,
}

#[derive(Debug, Clone)]
pub struct CareResult {
    pub from: String,
    pub target_id: String,
    pub nonce: String,
    pub ok: bool,
    pub reason: String,
    pub care: Option<CareStats>,
    pub at: u64,
}

#[derive(Debug, Clone)]
pub struct JoinResult {
    pub token: String,
    pub player_id: String,
    pub body: Value,
}

#[derive(Debug, Clone)]
pub enum StateOutcome {
    Body(Value),
    Closed(String),
}

#[derive(Debug, Clone)]
struct RateEntry {
    window_started: Instant,
    count: u32,
}

struct Poll {
    since: u64,
    sender: oneshot::Sender<PollWake>,
}

enum PollWake {
    State(Value),
    Closed(String),
}

struct Inner {
    version: u64,
    host_id: Option<String>,
    players: Vec<Player>,
    care_events: VecDeque<CareEvent>,
    care_results: VecDeque<CareResult>,
    game_events: VecDeque<GameEvent>,
    next_game_event_id: u64,
    authority: bool,
    join_attempts: HashMap<String, RateEntry>,
    join_order: VecDeque<String>,
    polls: HashMap<u64, Poll>,
    next_poll_id: u64,
    closing: bool,
    close_reason: String,
    notify_scheduled: bool,
}

pub struct Room {
    options: RoomOptions,
    code: String,
    code_hash: [u8; 32],
    expected_hosts: Vec<String>,
    inner: Mutex<Inner>,
    shutdown: watch::Sender<Option<String>>,
}

impl Room {
    pub fn new(
        options: RoomOptions,
        shutdown: watch::Sender<Option<String>>,
    ) -> Result<Arc<Self>, String> {
        let code =
            normalize_room_code(&options.code).ok_or_else(|| "room code is invalid".to_string())?;
        let advertised_host = options.advertised_host.to_ascii_lowercase();
        if !valid_room_host(&advertised_host) {
            return Err("room advertised host must be an IPv4 address or hostname".to_string());
        }
        if options.advertised_port.is_some_and(|port| port == 0) {
            return Err("room advertised port is invalid".to_string());
        }
        let expected_hosts = expected_hosts(
            &advertised_host,
            options.advertised_port,
            options.actual_port,
        );
        let mut hasher = Sha256::new();
        hasher.update(code.as_bytes());
        let code_hash: [u8; 32] = hasher.finalize().into();
        let authority = options.authority;
        Ok(Arc::new(Self {
            options,
            code,
            code_hash,
            expected_hosts,
            inner: Mutex::new(Inner {
                version: 1,
                host_id: None,
                players: Vec::new(),
                care_events: VecDeque::new(),
                care_results: VecDeque::new(),
                game_events: VecDeque::new(),
                next_game_event_id: 1,
                authority,
                join_attempts: HashMap::new(),
                join_order: VecDeque::new(),
                polls: HashMap::new(),
                next_poll_id: 1,
                closing: false,
                close_reason: "closed".to_string(),
                notify_scheduled: false,
            }),
            shutdown,
        }))
    }

    pub fn code(&self) -> &str {
        &self.code
    }

    pub fn expected_hosts(&self) -> &[String] {
        &self.expected_hosts
    }

    pub fn persistent(&self) -> bool {
        self.options.persistent
    }

    pub fn trust_proxy(&self) -> bool {
        self.options.trust_proxy
    }

    pub fn subscribe(&self) -> watch::Receiver<Option<String>> {
        self.shutdown.subscribe()
    }

    pub fn is_closing(&self) -> bool {
        self.inner.lock().expect("room lock").closing
    }

    pub fn close_reason(&self) -> String {
        self.inner.lock().expect("room lock").close_reason.clone()
    }

    pub fn player_count(&self) -> usize {
        self.inner.lock().expect("room lock").players.len()
    }

    pub fn snapshot(&self) -> Value {
        let inner = self.inner.lock().expect("room lock");
        body_locked(&self.code, &inner)
    }

    /// 房间的创建者：按加入顺序的第一位玩家。持久房间没有 host 标记，
    /// 左轮靠它决定谁能开局；排序必须与快照里给客户端的 players 顺序一致（joined_at）。
    pub fn is_owner(&self, player_id: &str) -> bool {
        let inner = self.inner.lock().expect("room lock");
        inner
            .players
            .iter()
            .min_by_key(|player| player.joined_at)
            .map(|player| player.id == player_id)
            .unwrap_or(false)
    }

    pub fn check_host(&self, host: &str) -> bool {
        self.expected_hosts.iter().any(|expected| expected == host)
    }

    /// 加入限流；每个 join 请求（哪怕 body 不合法）都计数。
    pub fn check_join_rate(&self, remote: &str) -> Result<(), ApiError> {
        let Some(limit) = &self.options.join_limit else {
            return Ok(());
        };
        let now = Instant::now();
        let mut inner = self.inner.lock().expect("room lock");
        if !inner.join_attempts.contains_key(remote) && inner.join_attempts.len() >= 128 {
            if let Some(oldest) = inner.join_order.pop_front() {
                inner.join_attempts.remove(&oldest);
            }
        }
        if !inner.join_attempts.contains_key(remote) {
            inner.join_order.push_back(remote.to_string());
        }
        let entry = inner
            .join_attempts
            .entry(remote.to_string())
            .or_insert_with(|| RateEntry {
                window_started: now,
                count: 0,
            });
        if now.duration_since(entry.window_started) > limit.window {
            entry.window_started = now;
            entry.count = 0;
        }
        entry.count += 1;
        if entry.count > limit.max {
            return Err(ApiError::new(429, "join-rate-limited"));
        }
        Ok(())
    }

    pub fn join(
        self: &Arc<Self>,
        client_id: String,
        code_input: &str,
        profile_value: &Value,
    ) -> Result<JoinResult, ApiError> {
        let Some(candidate) = normalize_room_code(code_input) else {
            return Err(ApiError::new(401, "room-code-invalid"));
        };
        let mut hasher = Sha256::new();
        hasher.update(candidate.as_bytes());
        let provided: [u8; 32] = hasher.finalize().into();
        if !constant_time_eq(&provided, &self.code_hash) {
            return Err(ApiError::new(401, "room-code-invalid"));
        }
        let profile =
            normalize_profile(profile_value).map_err(|_| ApiError::new(500, "server-error"))?;
        let token = hex::encode(random_bytes_32());
        let key = sha256_bytes(token.as_bytes());
        let id = random_uuid_v4();

        let mut inner = self.inner.lock().expect("room lock");
        // 时间戳在锁内采样：插入顺序与 joined_at 顺序一致，房主判定和客户端看到的顺序不会相反。
        let now = now_ms();
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        if inner.players.len() >= ROOM_MAX_PLAYERS {
            return Err(ApiError::new(429, "room-full"));
        }
        if inner
            .players
            .iter()
            .any(|player| player.client_id == client_id)
        {
            return Err(ApiError::new(409, "client-already-joined"));
        }
        let index = inner.players.len();
        let host = !self.options.persistent && index == 0;
        let player = Player {
            key,
            id: id.clone(),
            client_id,
            profile,
            x: spawn_x(index),
            y: 0.15 + (index % 3) as f64 * 0.14,
            row: (index % 3) as i64,
            facing: 1,
            emote: String::new(),
            emote_target: None,
            emote_at: 0,
            host,
            joined_at: now,
            last_seen_at: now,
            rev: 0,
            game_seq: 0,
            game_window: None,
        };
        if host {
            inner.host_id = Some(id.clone());
        }
        inner.players.push(player);
        let scheduled = bump_locked(&mut inner);
        let body = body_locked(&self.code, &inner);
        drop(inner);
        if scheduled {
            self.spawn_flush();
        }
        self.log("room player joined");
        Ok(JoinResult {
            token,
            player_id: id,
            body,
        })
    }

    /// 校验 token；返回玩家 id。顺带更新 lastSeen，超过 30 秒按 Node 版移除。
    pub fn authenticate(self: &Arc<Self>, token: &str) -> Result<String, ApiError> {
        let key = sha256_bytes(token.as_bytes());
        let now = now_ms();
        let mut scheduled = false;
        let mut expired_host = false;
        let mut removed_idle = false;
        let player_id;
        {
            let mut inner = self.inner.lock().expect("room lock");
            let Some(index) = inner.players.iter().position(|player| player.key == key) else {
                return Err(ApiError::new(401, "unauthorized"));
            };
            if now.saturating_sub(inner.players[index].last_seen_at) > ROOM_IDLE.as_millis() as u64
            {
                let player = inner.players.remove(index);
                removed_idle = true;
                expired_host = player.host;
                player_id = player.id;
                if expired_host {
                    inner.host_id = None;
                } else {
                    scheduled = bump_locked(&mut inner);
                }
            } else {
                inner.players[index].last_seen_at = now;
                player_id = inner.players[index].id.clone();
            }
        }
        if removed_idle {
            self.log("room player left idle");
            if scheduled {
                self.spawn_flush();
            }
            if expired_host {
                self.close("host-left");
            }
            return Err(ApiError::new(401, "session-expired"));
        }
        Ok(player_id)
    }

    pub async fn state(
        self: &Arc<Self>,
        player_id: &str,
        since: u64,
    ) -> Result<StateOutcome, ApiError> {
        let (immediate_body, poll_id, receiver) = {
            let mut inner = self.inner.lock().expect("room lock");
            if inner.closing {
                return Err(ApiError::new(503, "room-closed"));
            }
            if !inner.players.iter().any(|player| player.id == player_id) {
                return Err(ApiError::new(401, "unauthorized"));
            }
            if since != inner.version {
                (Some(body_locked(&self.code, &inner)), 0, None)
            } else {
                let poll_id = inner.next_poll_id;
                inner.next_poll_id += 1;
                let (sender, receiver) = oneshot::channel();
                inner.polls.insert(poll_id, Poll { since, sender });
                (None, poll_id, Some(receiver))
            }
        };
        if let Some(body) = immediate_body {
            return Ok(StateOutcome::Body(body));
        }
        let receiver = receiver.expect("poll receiver");
        let cleanup = PollCleanup {
            room: self.clone(),
            id: poll_id,
        };
        let wake = tokio::select! {
            wake = receiver => wake,
            _ = tokio::time::sleep(ROOM_STATE_HOLD) => {
                drop(cleanup);
                return Ok(StateOutcome::Body(self.snapshot()));
            }
        };
        drop(cleanup);
        match wake {
            Ok(PollWake::State(body)) => Ok(StateOutcome::Body(body)),
            Ok(PollWake::Closed(reason)) => Ok(StateOutcome::Closed(reason)),
            Err(_) => Ok(StateOutcome::Body(self.snapshot())),
        }
    }

    pub fn update(self: &Arc<Self>, player_id: &str, input: &Value) -> Result<Value, ApiError> {
        if !exact_keys(input, &["rev", "x", "y", "facing", "emote", "targetId"]) {
            return Err(ApiError::new(400, "update-shape-invalid"));
        }
        let Some(rev) = json_safe_integer(input.get("rev").unwrap_or(&Value::Null)) else {
            return Err(ApiError::new(400, "update-shape-invalid"));
        };
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let Some(index) = inner
            .players
            .iter()
            .position(|player| player.id == player_id)
        else {
            return Err(ApiError::new(401, "unauthorized"));
        };
        if rev <= inner.players[index].rev {
            let version = inner.version;
            return Ok(json!({ "ok": true, "version": version }));
        }
        let position = normalize_position(
            input.get("x").unwrap_or(&Value::Null),
            input.get("y").unwrap_or(&Value::Null),
            input.get("facing").unwrap_or(&Value::Null),
        )
        .map_err(|_| ApiError::new(500, "server-error"))?;
        let emote = normalize_emote(input.get("emote").unwrap_or(&Value::Null));
        let target_id = match input.get("targetId") {
            Some(Value::String(value)) => value.clone(),
            _ => String::new(),
        };
        if !emote.is_empty()
            && !target_id.is_empty()
            && !inner.players.iter().any(|player| player.id == target_id)
        {
            return Err(ApiError::new(400, "emote-target-invalid"));
        }
        let player = &mut inner.players[index];
        let changed = (position.x - player.x).abs() > 0.0005
            || (position.y - player.y).abs() > 0.0005
            || position.facing != player.facing
            || !emote.is_empty()
            || !player.emote.is_empty();
        player.rev = rev;
        player.x = position.x;
        player.y = position.y;
        player.facing = position.facing;
        if !emote.is_empty() {
            player.emote = emote;
            player.emote_target = Some(if target_id.is_empty() {
                player.id.clone()
            } else {
                target_id
            });
            player.emote_at = now_ms();
        } else if !player.emote.is_empty() {
            player.emote.clear();
            player.emote_target = None;
            player.emote_at = 0;
        }
        let scheduled = if changed {
            bump_locked(&mut inner)
        } else {
            false
        };
        let version = inner.version;
        drop(inner);
        if scheduled {
            self.spawn_flush();
        }
        Ok(json!({ "ok": true, "version": version }))
    }

    /// 校验并返回一条待处理动作；校验通过但 seq 已经处理过时返回 None。
    pub fn check_game(&self, player_id: &str, input: &Value) -> Result<Option<GameAction>, ApiError> {
        if !exact_keys(input, &["seq", "ext", "op", "data"]) {
            return Err(ApiError::new(400, "game-shape-invalid"));
        }
        let Some(seq) = json_safe_integer(input.get("seq").unwrap_or(&Value::Null)) else {
            return Err(ApiError::new(400, "game-seq-invalid"));
        };
        if seq == 0 {
            return Err(ApiError::new(400, "game-seq-invalid"));
        }
        let Some(ext) = input.get("ext").and_then(Value::as_str) else {
            return Err(ApiError::new(400, "game-ext-invalid"));
        };
        if !valid_game_key(ext, false) {
            return Err(ApiError::new(400, "game-ext-invalid"));
        }
        let Some(op) = input.get("op").and_then(Value::as_str) else {
            return Err(ApiError::new(400, "game-op-invalid"));
        };
        if !valid_game_key(op, true) {
            return Err(ApiError::new(400, "game-op-invalid"));
        }
        let Some(data) = input.get("data") else {
            return Err(ApiError::new(400, "game-data-invalid"));
        };
        if !data.is_object() || !valid_game_value(data, 0) {
            return Err(ApiError::new(400, "game-data-invalid"));
        }
        if serde_json::to_vec(data).map(|bytes| bytes.len()).unwrap_or(usize::MAX) > ROOM_GAME_MAX_DATA {
            return Err(ApiError::new(413, "game-data-too-large"));
        }
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let Some(index) = inner.players.iter().position(|player| player.id == player_id) else {
            return Err(ApiError::new(401, "unauthorized"));
        };
        let window = inner.players[index].game_window;
        let entry = match window {
            Some((started, count)) if started.elapsed() < ROOM_GAME_RATE_WINDOW => {
                if count >= ROOM_GAME_RATE_LIMIT {
                    return Err(ApiError::new(429, "game-rate-limited"));
                }
                (started, count + 1)
            }
            _ => (Instant::now(), 1),
        };
        inner.players[index].game_window = Some(entry);
        if seq <= inner.players[index].game_seq {
            return Ok(None);
        }
        Ok(Some(GameAction {
            seq,
            ext: ext.to_string(),
            op: op.to_string(),
            data: data.clone(),
        }))
    }

    /// 房主权威模式：记录玩家 seq 并把动作作为事件广播。
    pub fn accept_game(self: &Arc<Self>, player_id: &str, action: &GameAction) -> Result<Value, ApiError> {
        let now = now_ms();
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let Some(index) = inner.players.iter().position(|player| player.id == player_id) else {
            return Err(ApiError::new(401, "unauthorized"));
        };
        if action.seq <= inner.players[index].game_seq {
            let version = inner.version;
            return Ok(json!({ "ok": true, "duplicate": true, "version": version }));
        }
        inner.players[index].game_seq = action.seq;
        let event_id = append_game_locked(
            &mut inner,
            player_id.to_string(),
            &action.ext,
            &action.op,
            action.data.clone(),
            now,
        );
        let scheduled = bump_locked(&mut inner);
        let version = inner.version;
        drop(inner);
        if scheduled {
            self.spawn_flush();
        }
        Ok(json!({ "ok": true, "version": version, "eventId": event_id }))
    }

    /// 公网权威模式：动作已转给权威并成功，只推进玩家 seq。
    pub fn accept_seq(&self, player_id: &str, seq: u64) -> Result<bool, ApiError> {
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let Some(index) = inner.players.iter().position(|player| player.id == player_id) else {
            return Err(ApiError::new(401, "unauthorized"));
        };
        if seq <= inner.players[index].game_seq {
            return Ok(false);
        }
        inner.players[index].game_seq = seq;
        Ok(true)
    }

    pub fn game(self: &Arc<Self>, player_id: &str, input: &Value) -> Result<Value, ApiError> {
        match self.check_game(player_id, input)? {
            Some(action) => self.accept_game(player_id, &action),
            None => {
                let version = self.inner.lock().expect("room lock").version;
                Ok(json!({ "ok": true, "duplicate": true, "version": version }))
            }
        }
    }

    /// 公网权威进程产生的事件；from 由权威决定，不再取玩家 token。
    pub fn append_authority(
        self: &Arc<Self>,
        from: &str,
        ext: &str,
        op: &str,
        data: Value,
    ) -> Result<Value, ApiError> {
        if !valid_game_key(ext, false) || !valid_game_key(op, true) {
            return Err(ApiError::new(400, "authority-event-invalid"));
        }
        if !data.is_object() || !valid_game_value(&data, 0) {
            return Err(ApiError::new(400, "authority-event-invalid"));
        }
        if serde_json::to_vec(&data).map(|bytes| bytes.len()).unwrap_or(usize::MAX) > ROOM_GAME_MAX_DATA {
            return Err(ApiError::new(413, "authority-event-too-large"));
        }
        let now = now_ms();
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let event_id = append_game_locked(&mut inner, from.to_string(), ext, op, data, now);
        let scheduled = bump_locked(&mut inner);
        let version = inner.version;
        drop(inner);
        if scheduled {
            self.spawn_flush();
        }
        Ok(json!({ "ok": true, "version": version, "eventId": event_id }))
    }

    pub fn care(self: &Arc<Self>, player_id: &str, input: &Value) -> Result<Value, ApiError> {
        if !exact_keys(input, &["targetId", "itemKey", "op", "nonce"]) {
            return Err(ApiError::new(400, "care-shape-invalid"));
        }
        let intent: CareIntent =
            normalize_care_intent(input).map_err(|_| ApiError::new(500, "server-error"))?;
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let Some(from) = inner
            .players
            .iter()
            .find(|player| player.id == player_id)
            .map(|player| player.id.clone())
        else {
            return Err(ApiError::new(401, "unauthorized"));
        };
        if !inner
            .players
            .iter()
            .any(|player| player.id == intent.target_id)
        {
            return Err(ApiError::new(404, "care-target-missing"));
        }
        let event = CareEvent {
            id: random_uuid_v4(),
            from,
            target_id: intent.target_id,
            item_key: intent.item_key,
            op: intent.op,
            nonce: intent.nonce,
            at: now_ms(),
        };
        inner.care_events.push_back(event.clone());
        while inner.care_events.len() > 32 {
            inner.care_events.pop_front();
        }
        let scheduled = bump_locked(&mut inner);
        let version = inner.version;
        drop(inner);
        if scheduled {
            self.spawn_flush();
        }
        Ok(json!({ "ok": true, "eventId": event.id, "version": version }))
    }

    pub fn care_result(
        self: &Arc<Self>,
        player_id: &str,
        input: &Value,
    ) -> Result<Value, ApiError> {
        if !exact_keys(input, &["targetId", "nonce", "ok", "reason", "care"]) {
            return Err(ApiError::new(400, "care-result-shape-invalid"));
        }
        let target_id = match input.get("targetId") {
            Some(Value::String(value)) => value,
            _ => return Err(ApiError::new(403, "care-result-target-invalid")),
        };
        if target_id != player_id {
            return Err(ApiError::new(403, "care-result-target-invalid"));
        }
        let nonce = match input.get("nonce") {
            Some(Value::String(value)) if !value.is_empty() => value.clone(),
            _ => return Err(ApiError::new(400, "care-result-nonce-invalid")),
        };
        let ok = input.get("ok") == Some(&Value::Bool(true));
        let care = if ok {
            let care = normalize_care_stats(input.get("care"));
            let Some(care) = care else {
                return Err(ApiError::new(400, "care-result-care-invalid"));
            };
            Some(care)
        } else {
            None
        };
        let reason = match input.get("reason") {
            Some(Value::String(value)) => truncate_utf16(value, 80),
            _ => String::new(),
        };
        let mut inner = self.inner.lock().expect("room lock");
        if inner.closing {
            return Err(ApiError::new(503, "room-closed"));
        }
        let Some(player) = inner
            .players
            .iter_mut()
            .find(|player| player.id == player_id)
        else {
            return Err(ApiError::new(401, "unauthorized"));
        };
        if let Some(care) = &care {
            player.profile.care = care.clone();
        }
        let result = CareResult {
            from: player_id.to_string(),
            target_id: player_id.to_string(),
            nonce,
            ok,
            reason,
            care,
            at: now_ms(),
        };
        inner.care_results.push_back(result);
        while inner.care_results.len() > 32 {
            inner.care_results.pop_front();
        }
        let scheduled = bump_locked(&mut inner);
        let version = inner.version;
        drop(inner);
        if scheduled {
            self.spawn_flush();
        }
        Ok(json!({ "ok": true, "version": version }))
    }

    pub fn leave(self: &Arc<Self>, player_id: &str) -> Result<Value, ApiError> {
        let mut scheduled = false;
        let host;
        {
            let mut inner = self.inner.lock().expect("room lock");
            let Some(index) = inner
                .players
                .iter()
                .position(|player| player.id == player_id)
            else {
                return Err(ApiError::new(401, "unauthorized"));
            };
            let player = inner.players.remove(index);
            host = player.host;
            if host {
                inner.host_id = None;
            } else {
                scheduled = bump_locked(&mut inner);
            }
        }
        self.log("room player left");
        if scheduled {
            self.spawn_flush();
        }
        if host {
            let room = self.clone();
            tokio::spawn(async move {
                tokio::time::sleep(Duration::from_millis(10)).await;
                room.close("host-left");
            });
        }
        Ok(json!({ "ok": true }))
    }

    pub fn sweep_idle(self: &Arc<Self>) {
        let now = now_ms();
        let cutoff = now.saturating_sub(ROOM_IDLE.as_millis() as u64);
        let mut removed = 0usize;
        let mut scheduled = false;
        let mut host_left = false;
        {
            let mut inner = self.inner.lock().expect("room lock");
            if inner.closing {
                return;
            }
            let mut index = 0;
            while index < inner.players.len() {
                if inner.players[index].last_seen_at >= cutoff {
                    index += 1;
                    continue;
                }
                let player = inner.players.remove(index);
                let host = player.host;
                host_left |= host;
                if host {
                    inner.host_id = None;
                } else {
                    scheduled |= bump_locked(&mut inner);
                }
                removed += 1;
            }
        }
        for _ in 0..removed {
            self.log("room player left idle");
        }
        if scheduled {
            self.spawn_flush();
        }
        if host_left {
            self.close("host-left");
        }
    }

    pub fn close(&self, reason: &str) {
        let waiters: Vec<oneshot::Sender<PollWake>>;
        {
            let mut inner = self.inner.lock().expect("room lock");
            if inner.closing {
                return;
            }
            inner.closing = true;
            inner.close_reason = reason.to_string();
            inner.notify_scheduled = false;
            waiters = inner.polls.drain().map(|(_, poll)| poll.sender).collect();
            inner.players.clear();
            inner.care_events.clear();
            inner.care_results.clear();
            inner.game_events.clear();
            inner.join_attempts.clear();
            inner.join_order.clear();
        }
        for sender in waiters {
            let _ = sender.send(PollWake::Closed(reason.to_string()));
        }
        self.log(&format!("room closed ({reason})"));
        self.shutdown.send_replace(Some(reason.to_string()));
    }

    fn log(&self, message: &str) {
        if self.options.log {
            println!("{} [room] {}", iso8601_now(), message);
        }
    }

    fn spawn_flush(self: &Arc<Self>) {
        let room = self.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(40)).await;
            room.flush_polls();
        });
    }

    fn flush_polls(&self) {
        let closing;
        let mut body = None;
        let mut waiters = Vec::new();
        let close_reason;
        {
            let mut inner = self.inner.lock().expect("room lock");
            if !inner.notify_scheduled {
                return;
            }
            inner.notify_scheduled = false;
            closing = inner.closing;
            close_reason = inner.close_reason.clone();
            if !closing {
                let version = inner.version;
                body = Some(body_locked(&self.code, &inner));
                let mut keep = HashMap::new();
                for (id, poll) in inner.polls.drain() {
                    if poll.since == version {
                        keep.insert(id, poll);
                    } else {
                        waiters.push(poll.sender);
                    }
                }
                inner.polls = keep;
            } else {
                waiters.extend(inner.polls.drain().map(|(_, poll)| poll.sender));
            }
        }
        for sender in waiters {
            if closing {
                let _ = sender.send(PollWake::Closed(close_reason.clone()));
            } else if let Some(body) = &body {
                let _ = sender.send(PollWake::State(body.clone()));
            }
        }
    }
}

struct PollCleanup {
    room: Arc<Room>,
    id: u64,
}

impl Drop for PollCleanup {
    fn drop(&mut self) {
        self.room
            .inner
            .lock()
            .expect("room lock")
            .polls
            .remove(&self.id);
    }
}

fn expected_hosts(host: &str, advertised_port: Option<u16>, port: u16) -> Vec<String> {
    let external_port = advertised_port.unwrap_or(port);
    let mut hosts = vec![
        format!("{host}:{external_port}"),
        format!("{host}:{port}"),
        format!("127.0.0.1:{port}"),
        format!("localhost:{port}"),
    ];
    if external_port == 80 || external_port == 443 {
        hosts.push(host.to_string());
    }
    if port == 80 || port == 443 {
        hosts.push(host.to_string());
        hosts.push("127.0.0.1".to_string());
        hosts.push("localhost".to_string());
    }
    hosts
}

fn spawn_x(index: usize) -> f64 {
    if index == 0 {
        return 0.5;
    }
    let side = if index % 2 == 1 { 1.0 } else { -1.0 };
    let step = (index as f64 / 2.0).ceil();
    ((0.5 + side * step * 0.16).clamp(0.08, 0.92) * 1000.0).round() / 1000.0
}

fn bump_locked(inner: &mut Inner) -> bool {
    inner.version += 1;
    if inner.notify_scheduled {
        false
    } else {
        inner.notify_scheduled = true;
        true
    }
}

fn body_locked(code: &str, inner: &Inner) -> Value {
    let mut players: Vec<&Player> = inner.players.iter().collect();
    players.sort_by_key(|player| player.joined_at);
    json!({
        "ok": true,
        "version": inner.version,
        "room": {
            "code": code,
            "version": inner.version,
            "hostId": inner.host_id,
            "caps": ["game"],
            "authority": if inner.authority { "server" } else { "host" },
        },
        "players": players.iter().map(|player| public_player(player)).collect::<Vec<_>>(),
        "careEvents": inner.care_events.iter().map(care_event_json).collect::<Vec<_>>(),
        "careResults": inner.care_results.iter().map(care_result_json).collect::<Vec<_>>(),
        "gameEvents": inner.game_events.iter().map(game_event_json).collect::<Vec<_>>(),
    })
}

fn game_event_json(event: &GameEvent) -> Value {
    json!({
        "id": event.id,
        "from": event.from,
        "ext": event.ext,
        "op": event.op,
        "data": event.data,
        "at": event.at,
    })
}

fn public_player(player: &Player) -> Value {
    let mut map: Map<String, Value> = profile_json(&player.profile);
    map.insert("id".to_string(), Value::String(player.id.clone()));
    map.insert("x".to_string(), json_number(player.x));
    map.insert("y".to_string(), json_number(player.y.clamp(0.0, 1.0)));
    map.insert("facing".to_string(), Value::from(player.facing));
    map.insert(
        "row".to_string(),
        Value::from(if player.row == 1 || player.row == 2 {
            player.row
        } else {
            0
        }),
    );
    map.insert("emote".to_string(), Value::String(player.emote.clone()));
    map.insert(
        "emoteTarget".to_string(),
        player
            .emote_target
            .clone()
            .map(Value::String)
            .unwrap_or(Value::Null),
    );
    map.insert("emoteAt".to_string(), Value::from(player.emote_at));
    map.insert("host".to_string(), Value::Bool(player.host));
    Value::Object(map)
}

fn care_event_json(event: &CareEvent) -> Value {
    json!({
        "id": event.id,
        "from": event.from,
        "targetId": event.target_id,
        "itemKey": event.item_key,
        "op": event.op,
        "nonce": event.nonce,
        "at": event.at,
    })
}

fn care_result_json(result: &CareResult) -> Value {
    json!({
        "from": result.from,
        "targetId": result.target_id,
        "nonce": result.nonce,
        "ok": result.ok,
        "reason": result.reason,
        "care": result.care.as_ref().map(care_stats_json),
        "at": result.at,
    })
}

fn sha256_bytes(value: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(value);
    hasher.finalize().into()
}

pub fn constant_time_eq(left: &[u8; 32], right: &[u8; 32]) -> bool {
    left.ct_eq(right).into()
}

fn random_bytes_32() -> [u8; 32] {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::room_code::generate_room_code;

    fn room() -> Arc<Room> {
        room_with_persistent(true)
    }

    fn room_with_persistent(persistent: bool) -> Arc<Room> {
        let (shutdown, _) = watch::channel(None);
        Room::new(
            RoomOptions {
                code: "7K2M".to_string(),
                advertised_host: "127.0.0.1".to_string(),
                advertised_port: Some(47824),
                actual_port: 47824,
                persistent,
                trust_proxy: false,
                authority: false,
                join_limit: None,
                log: false,
            },
            shutdown,
        )
        .expect("room")
    }

    #[test]
    fn spawn_positions_match_node() {
        let expected = [0.5, 0.66, 0.34, 0.82, 0.18, 0.92, 0.08, 0.92];
        for (index, value) in expected.iter().enumerate() {
            assert_eq!(spawn_x(index), *value, "index {index}");
        }
    }

    #[test]
    fn expected_hosts_include_proxy_forms() {
        let hosts = expected_hosts("piggy.example.com", Some(8443), 47824);
        assert!(hosts.contains(&"piggy.example.com:8443".to_string()));
        assert!(hosts.contains(&"piggy.example.com:47824".to_string()));
        assert!(hosts.contains(&"127.0.0.1:47824".to_string()));
        assert!(!hosts.contains(&"piggy.example.com".to_string()));

        let hosts = expected_hosts("piggy.example.com", Some(443), 47824);
        assert!(hosts.contains(&"piggy.example.com".to_string()));
        assert!(hosts.contains(&"piggy.example.com:443".to_string()));
    }

    #[test]
    fn constant_time_comparison_works() {
        assert!(constant_time_eq(&[7u8; 32], &[7u8; 32]));
        assert!(!constant_time_eq(&[7u8; 32], &[8u8; 32]));
    }

    #[tokio::test]
    async fn room_code_and_rate_limit_are_enforced() {
        let room = room();
        assert!(room.check_join_rate("127.0.0.1").is_ok());
        let wrong = room.join("a".to_string(), "AAAA", &json!({ "name": "a", "level": 1 }));
        assert_eq!(wrong.unwrap_err().reason, "room-code-invalid");
        let joined = room
            .join("a".to_string(), "7K2M", &json!({ "name": "a", "level": 1 }))
            .expect("joined");
        assert_eq!(joined.body["players"].as_array().unwrap().len(), 1);
        assert_eq!(joined.body["players"][0]["host"], false);
        assert_eq!(joined.body["room"]["hostId"], Value::Null);
        let duplicate = room
            .join("a".to_string(), "7K2M", &json!({ "name": "a", "level": 1 }))
            .unwrap_err();
        assert_eq!(duplicate.status, 409);
        let _ = generate_room_code();
    }

    #[tokio::test]
    async fn idle_players_are_swept_and_host_closes_the_room() {
        let room = room();
        room.join(
            "idle-a".to_string(),
            "7K2M",
            &json!({ "name": "a", "level": 1 }),
        )
        .expect("joined");
        {
            let mut inner = room.inner.lock().expect("lock");
            inner.players[0].last_seen_at = now_ms().saturating_sub(30_001);
        }
        room.sweep_idle();
        assert_eq!(room.player_count(), 0);
        assert!(!room.is_closing());

        let host_room = room_with_persistent(false);
        host_room
            .join(
                "idle-host".to_string(),
                "7K2M",
                &json!({ "name": "host", "level": 1 }),
            )
            .expect("joined");
        {
            let mut inner = host_room.inner.lock().expect("lock");
            inner.players[0].last_seen_at = now_ms().saturating_sub(30_001);
        }
        host_room.sweep_idle();
        assert!(host_room.is_closing());
        assert_eq!(host_room.close_reason(), "host-left");
        assert_eq!(host_room.player_count(), 0);
    }
}
