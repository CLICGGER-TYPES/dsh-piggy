//! 房间协议里跨进程 / 跨设备共用的字段校验与归一化。

use std::net::Ipv4Addr;

use serde_json::{json, Map, Value};

use crate::util::{clean_text, is_safe_integer, js_number, json_number, whole};

pub const ROOM_MAX_PLAYERS: usize = 32;
pub const ROOM_MAX_NAME: usize = 24;
pub const ROOM_MAX_BODY: usize = 4096;
pub const ROOM_EMOTES: [&str; 3] = ["wave", "pat", "jump"];
pub const ROOM_CARE_OPS: [&str; 4] = ["feed", "bathe", "play", "medicine"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProfileError;

#[derive(Debug, Clone)]
pub struct CareStats {
    pub satiety: i64,
    pub cleanliness: i64,
    pub happiness: i64,
}

#[derive(Debug, Clone)]
pub struct ActionState {
    pub ready: bool,
    pub wait_seconds: i64,
    pub blocked: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Actions {
    pub feed: ActionState,
    pub bathe: ActionState,
    pub play: ActionState,
    pub pet: ActionState,
}

#[derive(Debug, Clone)]
pub struct LevelInfo {
    pub level: i64,
    pub percent: i64,
    pub to_next: i64,
    pub maxed: bool,
    pub title_emoji: String,
    pub title_label: String,
}

#[derive(Debug, Clone)]
pub struct Traits {
    pub intel: i64,
    pub charm: i64,
    pub strong: i64,
}

#[derive(Debug, Clone)]
pub struct BodyWeight {
    pub label: String,
    pub locked: bool,
}

#[derive(Debug, Clone)]
pub struct Illness {
    pub name: String,
    pub stage: i64,
    pub chain_key: String,
    pub cure: String,
    pub cure_key: String,
    pub cure_emoji: String,
    pub doctor_fee: i64,
}

#[derive(Debug, Clone)]
pub struct Status {
    pub level: LevelInfo,
    pub health: i64,
    pub health_percent: i64,
    pub max_health: i64,
    pub traits: Traits,
    pub weight: String,
    pub body_weight: Option<BodyWeight>,
    pub mood: String,
    pub mood_label: String,
    pub illness: Option<Illness>,
}

#[derive(Debug, Clone)]
pub struct EmojiLabel {
    pub emoji: String,
    pub label: String,
}

#[derive(Debug, Clone)]
pub struct CardCounts {
    pub days: i64,
    pub certificates: i64,
    pub souvenirs: i64,
    pub graduations: i64,
}

#[derive(Debug, Clone)]
pub struct Card {
    pub birthday: String,
    pub zodiac: Option<EmojiLabel>,
    pub personality: Option<EmojiLabel>,
    pub catchphrase: String,
    pub motto: String,
    pub counts: Option<CardCounts>,
}

#[derive(Debug, Clone)]
pub struct Profile {
    pub name: String,
    pub level: i64,
    pub stage: String,
    pub art: String,
    pub emoji: String,
    pub size: f64,
    pub label: String,
    pub care: CareStats,
    pub actions: Actions,
    pub mood: String,
    pub mood_label: String,
    pub status: Status,
    pub card: Card,
}

#[derive(Debug, Clone)]
pub struct Position {
    pub x: f64,
    pub y: f64,
    pub facing: i64,
}

#[derive(Debug, Clone)]
pub struct CareIntent {
    pub target_id: String,
    pub item_key: String,
    pub op: String,
    pub nonce: String,
}

fn object(value: Option<&Value>) -> Option<&Map<String, Value>> {
    value.and_then(Value::as_object)
}

fn field<'a>(value: Option<&'a Value>, key: &str) -> Option<&'a Value> {
    value
        .and_then(Value::as_object)
        .and_then(|map| map.get(key))
}

fn public_actions(value: Option<&Value>) -> Actions {
    fn action(value: Option<&Value>, key: &str) -> ActionState {
        let source = field(value, key);
        let blocked = match field(source, "blocked") {
            Some(Value::String(value)) if value == "away" || value == "hungry" => {
                Some(value.clone())
            }
            _ => None,
        };
        ActionState {
            ready: field(source, "ready") != Some(&Value::Bool(false)),
            wait_seconds: whole(field(source, "waitSeconds"), 0, 3_600, 0),
            blocked,
        }
    }
    Actions {
        feed: action(value, "feed"),
        bathe: action(value, "bathe"),
        play: action(value, "play"),
        pet: action(value, "pet"),
    }
}

fn public_level(value: Option<&Value>) -> LevelInfo {
    let input = field(value, "level");
    LevelInfo {
        level: whole(field(input, "level"), 1, 999, 1),
        percent: whole(field(input, "percent"), 0, 100, 0),
        to_next: whole(field(input, "toNext"), 0, 1_000_000_000, 0),
        maxed: field(input, "maxed") == Some(&Value::Bool(true)),
        title_emoji: clean_text(field(input, "titleEmoji"), 8),
        title_label: clean_text(field(input, "titleLabel"), 16),
    }
}

fn public_status(value: Option<&Value>) -> Status {
    let input = if value.is_some_and(Value::is_object) {
        value
    } else {
        None
    };
    let traits = field(input, "traits");
    let body = field(input, "bodyWeight");
    let body_weight = body.and_then(Value::as_object).map(|body| BodyWeight {
        label: clean_text(body.get("label"), 24),
        locked: body.get("locked") == Some(&Value::Bool(true)),
    });
    let illness = field(input, "illness")
        .and_then(Value::as_object)
        .map(|illness| Illness {
            name: clean_text(illness.get("name"), 24),
            stage: whole(illness.get("stage"), 1, 4, 1),
            chain_key: clean_text(illness.get("chainKey"), 24),
            cure: clean_text(illness.get("cure"), 24),
            cure_key: clean_text(illness.get("cureKey"), 40),
            cure_emoji: clean_text(illness.get("cureEmoji"), 8),
            doctor_fee: whole(illness.get("doctorFee"), 0, 1_000_000_000, 0),
        });
    Status {
        level: public_level(input),
        health: whole(field(input, "health"), 0, 9, 5),
        health_percent: whole(field(input, "healthPercent"), 0, 100, 100),
        max_health: whole(field(input, "maxHealth"), 1, 9, 5),
        traits: Traits {
            intel: whole(field(traits, "intel"), 0, 999, 0),
            charm: whole(field(traits, "charm"), 0, 999, 0),
            strong: whole(field(traits, "strong"), 0, 999, 0),
        },
        weight: clean_text(field(input, "weight"), 32),
        body_weight,
        mood: clean_text(field(input, "mood"), 24),
        mood_label: clean_text(field(input, "moodLabel"), 24),
        illness,
    }
}

fn public_card(value: Option<&Value>) -> Card {
    let input = if value.is_some_and(Value::is_object) {
        value
    } else {
        None
    };
    let zodiac = field(input, "zodiac").and_then(Value::as_object);
    let personality = field(input, "personality").and_then(Value::as_object);
    let counts = field(input, "counts").and_then(Value::as_object);
    Card {
        birthday: clean_text(field(input, "birthday"), 32),
        zodiac: zodiac.map(|value| EmojiLabel {
            emoji: clean_text(value.get("emoji"), 8),
            label: clean_text(value.get("label"), 16),
        }),
        personality: personality.map(|value| EmojiLabel {
            emoji: clean_text(value.get("emoji"), 8),
            label: clean_text(value.get("label"), 16),
        }),
        catchphrase: clean_text(field(input, "catchphrase"), 32),
        motto: clean_text(field(input, "motto"), 80),
        counts: counts.map(|counts| CardCounts {
            days: whole(counts.get("days"), 0, 1_000_000_000, 0),
            certificates: whole(counts.get("certificates"), 0, 1_000_000_000, 0),
            souvenirs: whole(counts.get("souvenirs"), 0, 1_000_000_000, 0),
            graduations: whole(counts.get("graduations"), 0, 1_000_000_000, 0),
        }),
    }
}

fn care_value(value: Option<&Value>) -> i64 {
    let number = value.map(js_number).unwrap_or(f64::NAN);
    if number.is_finite() {
        (number.round() as i64).clamp(0, 100)
    } else {
        60
    }
}

pub fn normalize_profile(value: &Value) -> Result<Profile, ProfileError> {
    let input = value.as_object().ok_or(ProfileError)?;
    let name = clean_text(input.get("name"), ROOM_MAX_NAME);
    if name.is_empty() {
        return Err(ProfileError);
    }
    let level = js_number(input.get("level").unwrap_or(&Value::Null));
    if !is_safe_integer(level) || !(1.0..=999.0).contains(&level) {
        return Err(ProfileError);
    }
    let stage = match input.get("stage") {
        Some(Value::String(value)) if valid_stage(value) => value.clone(),
        _ => "piglet".to_string(),
    };
    let art = match input.get("art") {
        Some(Value::String(value)) if valid_art(value) => value.clone(),
        _ => String::new(),
    };
    let emoji = {
        let cleaned = clean_text(input.get("emoji"), 8);
        if cleaned.is_empty() {
            "🐖".to_string()
        } else {
            cleaned
        }
    };
    let size_number = input.get("size").map(js_number).unwrap_or(f64::NAN);
    let size = if size_number.is_finite() {
        size_number.clamp(0.5, 1.6)
    } else {
        1.0
    };
    let care_input = input.get("care").and_then(Value::as_object);
    let care = CareStats {
        satiety: care_value(care_input.and_then(|care| care.get("satiety"))),
        cleanliness: care_value(care_input.and_then(|care| care.get("cleanliness"))),
        happiness: care_value(care_input.and_then(|care| care.get("happiness"))),
    };
    Ok(Profile {
        name,
        level: level as i64,
        stage,
        art,
        emoji,
        size,
        label: clean_text(input.get("label"), 16),
        care,
        actions: public_actions(input.get("actions")),
        mood: clean_text(input.get("mood"), 24),
        mood_label: clean_text(input.get("moodLabel"), 24),
        status: public_status(input.get("status")),
        card: public_card(input.get("card")),
    })
}

fn valid_stage(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.is_empty() || bytes.len() > 32 {
        return false;
    }
    if !bytes[0].is_ascii_lowercase() {
        return false;
    }
    bytes
        .iter()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'-')
}

fn valid_art(value: &str) -> bool {
    let (base, query) = match value.split_once('?') {
        Some((base, query)) => (base, Some(query)),
        None => (value, None),
    };
    if let Some(query) = query {
        let Some(version) = query.strip_prefix("v=") else {
            return false;
        };
        if version.is_empty()
            || version.len() > 32
            || !version
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        {
            return false;
        }
    }
    if let Some(rest) = base.strip_prefix("pigs/") {
        if rest.is_empty() || rest.len() > 160 {
            return false;
        }
        if !base
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'/' | b'-'))
        {
            return false;
        }
        for extension in [".png", ".webp"] {
            if let Some(prefix) = rest.strip_suffix(extension) {
                return !prefix.is_empty();
            }
        }
        return false;
    }
    if let Some(rest) = base.strip_prefix("custom-") {
        return !rest.is_empty()
            && rest.len() <= 41
            && rest
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    }
    false
}

pub fn normalize_client_id(value: &Value) -> Option<String> {
    let Value::String(value) = value else {
        return None;
    };
    let count = value.chars().count();
    if !(1..=80).contains(&count) {
        return None;
    }
    if value
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b':' | b'-'))
    {
        Some(value.clone())
    } else {
        None
    }
}

pub fn normalize_position(x: &Value, y: &Value, facing: &Value) -> Result<Position, ProfileError> {
    let x = js_number(x);
    let y = js_number(y);
    if !x.is_finite() || !y.is_finite() {
        return Err(ProfileError);
    }
    Ok(Position {
        x: round_milli(x.clamp(0.0, 1.0)),
        y: round_milli(y.clamp(0.0, 1.0)),
        facing: if js_number(facing) < 0.0 { -1 } else { 1 },
    })
}

fn round_milli(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

pub fn normalize_emote(value: &Value) -> String {
    match value {
        Value::String(value) if ROOM_EMOTES.contains(&value.as_str()) => value.clone(),
        _ => String::new(),
    }
}

/// 房间地址允许 IPv4、域名和 localhost；不接受 IPv6、通配地址和纯数字伪 IPv4。
pub fn valid_room_host(value: &str) -> bool {
    let host = value
        .trim_matches(crate::util::is_js_whitespace)
        .to_ascii_lowercase();
    if host.is_empty() || host.len() > 253 {
        return false;
    }
    if let Ok(address) = host.parse::<Ipv4Addr>() {
        let first = address.octets()[0];
        return first > 0 && first < 224;
    }
    if host.contains(':') || host.parse::<std::net::IpAddr>().is_ok() {
        return false;
    }
    if looks_like_pseudo_ipv4(&host) {
        return false;
    }
    if host.contains("..") {
        return false;
    }
    host.split('.').all(valid_hostname_label)
}

fn looks_like_pseudo_ipv4(host: &str) -> bool {
    let mut parts = 0;
    for part in host.split('.') {
        if part.is_empty() || part.len() > 3 || !part.bytes().all(|byte| byte.is_ascii_digit()) {
            return false;
        }
        parts += 1;
    }
    parts == 4
}

fn valid_hostname_label(label: &str) -> bool {
    if label.is_empty() || label.len() > 63 {
        return false;
    }
    let bytes = label.as_bytes();
    if !bytes[0].is_ascii_alphanumeric() || !bytes[bytes.len() - 1].is_ascii_alphanumeric() {
        return false;
    }
    bytes
        .iter()
        .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'-')
}

pub fn normalize_care_intent(value: &Value) -> Result<CareIntent, ProfileError> {
    let input = value.as_object().ok_or(ProfileError)?;
    let target_id = match input.get("targetId") {
        Some(Value::String(value)) => value.clone(),
        _ => String::new(),
    };
    let item_key = match input.get("itemKey") {
        Some(Value::String(value)) => value.clone(),
        _ => String::new(),
    };
    let op = match input.get("op") {
        Some(Value::String(value)) => value.clone(),
        _ => String::new(),
    };
    let nonce = match input.get("nonce") {
        Some(Value::String(value)) => value.clone(),
        _ => String::new(),
    };
    if target_id.is_empty() || target_id.encode_utf16().count() > 80 {
        return Err(ProfileError);
    }
    if item_key.is_empty()
        || item_key.len() > 48
        || !item_key
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
    {
        return Err(ProfileError);
    }
    if !ROOM_CARE_OPS.contains(&op.as_str()) {
        return Err(ProfileError);
    }
    if nonce.is_empty()
        || nonce.encode_utf16().count() > 80
        || !nonce
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'-'))
    {
        return Err(ProfileError);
    }
    Ok(CareIntent {
        target_id,
        item_key,
        op,
        nonce,
    })
}

pub fn normalize_care_stats(value: Option<&Value>) -> Option<CareStats> {
    let input = object(value)?;
    let mut numbers = [0i64; 3];
    for (index, key) in ["satiety", "cleanliness", "happiness"].iter().enumerate() {
        let number = input.get(*key).map(js_number).unwrap_or(f64::NAN);
        if !number.is_finite() {
            return None;
        }
        numbers[index] = (number.round() as i64).clamp(0, 100);
    }
    Some(CareStats {
        satiety: numbers[0],
        cleanliness: numbers[1],
        happiness: numbers[2],
    })
}

/// 只接受指定 key，和 Node 的 exactKeys 一致。
pub fn exact_keys(value: &Value, keys: &[&str]) -> bool {
    let Some(map) = value.as_object() else {
        return false;
    };
    map.len() == keys.len() && keys.iter().all(|key| map.contains_key(*key))
}

pub fn truncate_utf16(value: &str, max: usize) -> String {
    String::from_utf16_lossy(&value.encode_utf16().take(max).collect::<Vec<_>>())
}

pub fn care_stats_json(stats: &CareStats) -> Value {
    json!({
        "satiety": stats.satiety,
        "cleanliness": stats.cleanliness,
        "happiness": stats.happiness,
    })
}

pub fn profile_json(profile: &Profile) -> Map<String, Value> {
    let status = &profile.status;
    let card = &profile.card;
    let mut map = Map::new();
    map.insert("name".into(), Value::String(profile.name.clone()));
    map.insert("level".into(), Value::from(profile.level));
    map.insert("stage".into(), Value::String(profile.stage.clone()));
    map.insert("art".into(), Value::String(profile.art.clone()));
    map.insert("emoji".into(), Value::String(profile.emoji.clone()));
    map.insert("size".into(), json_number(profile.size));
    map.insert("label".into(), Value::String(profile.label.clone()));
    map.insert("care".into(), care_stats_json(&profile.care));
    map.insert("mood".into(), Value::String(profile.mood.clone()));
    map.insert(
        "moodLabel".into(),
        Value::String(profile.mood_label.clone()),
    );
    map.insert(
        "status".into(),
        json!({
            "level": {
                "level": status.level.level,
                "percent": status.level.percent,
                "toNext": status.level.to_next,
                "maxed": status.level.maxed,
                "titleEmoji": status.level.title_emoji,
                "titleLabel": status.level.title_label,
            },
            "health": status.health,
            "healthPercent": status.health_percent,
            "maxHealth": status.max_health,
            "traits": {
                "intel": status.traits.intel,
                "charm": status.traits.charm,
                "strong": status.traits.strong,
            },
            "weight": status.weight,
            "bodyWeight": status.body_weight.as_ref().map(|body| json!({
                "label": body.label,
                "locked": body.locked,
            })),
            "mood": status.mood,
            "moodLabel": status.mood_label,
            "illness": status.illness.as_ref().map(|illness| json!({
                "name": illness.name,
                "stage": illness.stage,
                "chainKey": illness.chain_key,
                "cure": illness.cure,
                "cureKey": illness.cure_key,
                "cureEmoji": illness.cure_emoji,
                "doctorFee": illness.doctor_fee,
            })),
        }),
    );
    map.insert(
        "card".into(),
        json!({
            "birthday": card.birthday,
            "zodiac": card.zodiac.as_ref().map(|value| json!({
                "emoji": value.emoji,
                "label": value.label,
            })),
            "personality": card.personality.as_ref().map(|value| json!({
                "emoji": value.emoji,
                "label": value.label,
            })),
            "catchphrase": card.catchphrase,
            "motto": card.motto,
            "counts": card.counts.as_ref().map(|counts| json!({
                "days": counts.days,
                "certificates": counts.certificates,
                "souvenirs": counts.souvenirs,
                "graduations": counts.graduations,
            })),
        }),
    );
    map
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_profile() -> Value {
        json!({
            "name": "  小 猪 ",
            "level": 60,
            "stage": "piglet",
            "art": "pigs/base/idle.png?v=abc123",
            "emoji": "🐖",
            "size": 0.9,
            "label": "tester",
            "care": { "satiety": 80, "cleanliness": 70.4, "happiness": 120 },
            "actions": {
                "feed": { "ready": false, "waitSeconds": 61.6, "blocked": "hungry" },
                "bathe": { "ready": true, "waitSeconds": -4, "blocked": "other" },
                "play": {},
                "pet": null
            },
            "mood": "happy",
            "moodLabel": "开心",
            "status": {
                "level": { "level": 60, "percent": 20, "toNext": 80, "maxed": true, "titleEmoji": "⭐", "titleLabel": "星星" },
                "health": 7, "healthPercent": 88, "maxHealth": 9,
                "traits": { "intel": 5, "charm": 6, "strong": 7 },
                "weight": "10kg",
                "bodyWeight": { "label": "标准", "locked": true },
                "mood": "happy", "moodLabel": "开心",
                "illness": { "name": "感冒", "stage": 2, "chainKey": "cold", "cure": "药", "cureKey": "medicine", "cureEmoji": "💊", "doctorFee": 30 }
            },
            "card": {
                "birthday": "1月1日",
                "zodiac": { "emoji": "🐷", "label": "猪" },
                "personality": null,
                "catchphrase": "哼",
                "motto": "吃好睡好",
                "counts": { "days": 3, "certificates": 4, "souvenirs": 5, "graduations": 6 }
            }
        })
    }

    #[test]
    fn profile_normalizes_public_fields() {
        let profile = normalize_profile(&sample_profile()).expect("valid profile");
        assert_eq!(profile.name, "小 猪");
        assert_eq!(profile.level, 60);
        assert_eq!(profile.care.satiety, 80);
        assert_eq!(profile.care.cleanliness, 70);
        assert_eq!(profile.care.happiness, 100);
        assert!(!profile.actions.feed.ready);
        assert_eq!(profile.actions.feed.wait_seconds, 62);
        assert_eq!(profile.actions.feed.blocked.as_deref(), Some("hungry"));
        assert_eq!(profile.actions.bathe.wait_seconds, 0);
        assert_eq!(profile.actions.bathe.blocked, None);
        assert!(profile.actions.play.ready);
        assert_eq!(profile.status.health, 7);
        assert!(profile.status.level.maxed);
        assert!(profile.card.zodiac.is_some());
        assert!(profile.card.personality.is_none());
        assert!(profile.card.counts.is_some());

        let output = Value::Object(profile_json(&profile));
        assert!(output.get("actions").is_none());
        assert_eq!(output["status"]["bodyWeight"]["locked"], true);
        assert_eq!(output["status"]["illness"]["stage"], 2);
        assert_eq!(output["card"]["counts"]["days"], 3);
    }

    #[test]
    fn profile_defaults_match_node() {
        let profile = normalize_profile(&json!({ "name": "a", "level": 1 })).expect("valid");
        assert_eq!(profile.stage, "piglet");
        assert_eq!(profile.art, "");
        assert_eq!(profile.emoji, "🐖");
        assert_eq!(profile.size, 1.0);
        assert_eq!(profile.care.satiety, 60);
        assert_eq!(profile.status.level.level, 1);
        assert_eq!(profile.status.health, 5);
        assert_eq!(profile.status.health_percent, 100);
        assert_eq!(profile.card.birthday, "");
        assert!(profile.status.body_weight.is_none());
        assert!(profile.status.illness.is_none());
        assert!(profile.card.counts.is_none());
    }

    #[test]
    fn profile_rejects_bad_input() {
        assert!(normalize_profile(&json!(null)).is_err());
        assert!(normalize_profile(&json!([])).is_err());
        assert!(normalize_profile(&json!({ "name": "", "level": 1 })).is_err());
        assert!(normalize_profile(&json!({ "name": "a", "level": 0 })).is_err());
        assert!(normalize_profile(&json!({ "name": "a", "level": "1.5" })).is_err());
        assert!(normalize_profile(&json!({ "name": "a", "level": 1000 })).is_err());
    }

    #[test]
    fn position_and_emote_normalize() {
        let position = normalize_position(&json!(1.2345), &json!(-2), &json!(-0.1)).expect("valid");
        assert_eq!(position.x, 1.0);
        assert_eq!(position.y, 0.0);
        assert_eq!(position.facing, -1);
        let position = normalize_position(&json!("0.1234"), &json!(0.5), &json!(0)).expect("valid");
        assert_eq!(position.x, 0.123);
        assert_eq!(position.y, 0.5);
        assert_eq!(position.facing, 1);
        assert!(normalize_position(&json!("x"), &json!(0), &json!(1)).is_err());

        assert_eq!(normalize_emote(&json!("wave")), "wave");
        assert_eq!(normalize_emote(&json!("dance")), "");
        assert_eq!(normalize_emote(&json!(null)), "");
    }

    #[test]
    fn client_id_and_care_intent_validate() {
        assert_eq!(
            normalize_client_id(&json!("abc-123_x:y.z")).as_deref(),
            Some("abc-123_x:y.z")
        );
        assert_eq!(normalize_client_id(&json!("")), None);
        assert_eq!(normalize_client_id(&json!("bad space")), None);

        let intent = normalize_care_intent(&json!({
            "targetId": "abc", "itemKey": "apple-1", "op": "feed", "nonce": "n-1"
        }))
        .expect("valid");
        assert_eq!(intent.op, "feed");
        assert!(normalize_care_intent(&json!({
            "targetId": "abc", "itemKey": "Apple", "op": "feed", "nonce": "n-1"
        }))
        .is_err());
        assert!(normalize_care_intent(&json!({
            "targetId": "abc", "itemKey": "apple", "op": "sleep", "nonce": "n-1"
        }))
        .is_err());
    }

    #[test]
    fn care_stats_need_all_three_numbers() {
        let stats = normalize_care_stats(Some(&json!({
            "satiety": 10.4, "cleanliness": -2, "happiness": 120
        })))
        .expect("valid");
        assert_eq!(stats.satiety, 10);
        assert_eq!(stats.cleanliness, 0);
        assert_eq!(stats.happiness, 100);
        assert!(normalize_care_stats(Some(&json!({ "satiety": 1 }))).is_none());
        assert!(normalize_care_stats(Some(&json!("x"))).is_none());
        assert!(normalize_care_stats(None).is_none());
    }

    #[test]
    fn host_validation_matches_node_rules() {
        for host in [
            "127.0.0.1",
            "192.168.1.20",
            "piggy.example.com",
            "localhost",
            "a-b.c",
        ] {
            assert!(valid_room_host(host), "{host}");
        }
        for host in [
            "",
            "0.0.0.0",
            "224.0.0.1",
            "999.1.1.1",
            "::1",
            "[::1]",
            "under_score.example.com",
            "trailing.example.com.",
            "double..dot",
            "-bad.example.com",
        ] {
            assert!(!valid_room_host(host), "{host}");
        }
    }

    #[test]
    fn art_validation_covers_query_version() {
        assert!(valid_art("pigs/base/idle.png?v=abc123"));
        assert!(valid_art("custom-abc-123"));
        assert!(!valid_art("pigs/base/idle.gif"));
        assert!(!valid_art("pigs/.png"));
        assert!(!valid_art("custom-ABC"));
        assert!(!valid_art("pigs/base/idle.png?v=xyz"));
    }

    #[test]
    fn exact_keys_requires_exact_set() {
        assert!(exact_keys(&json!({}), &[]));
        assert!(exact_keys(&json!({ "a": 1, "b": 2 }), &["b", "a"]));
        assert!(!exact_keys(&json!({ "a": 1 }), &["a", "b"]));
        assert!(!exact_keys(&json!({ "a": 1, "b": 2 }), &["a"]));
        assert!(!exact_keys(&json!([]), &[]));
    }
}
