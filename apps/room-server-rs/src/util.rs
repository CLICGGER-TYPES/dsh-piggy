//! 小工具：JS 兼容的字符串/数字归一化、时间、UUID。

use std::time::{SystemTime, UNIX_EPOCH};

use rand::rngs::OsRng;
use rand::RngCore;
use serde_json::{Number, Value};

pub const JS_MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// JS 的 `\s` 比 Rust 的 `char::is_whitespace` 多一个 BOM。
pub fn is_js_whitespace(character: char) -> bool {
    character.is_whitespace() || character == '\u{feff}'
}

/// 对应 room-protocol.js 的 `cleanText`。
pub fn clean_text(value: Option<&Value>, max: usize) -> String {
    let Some(Value::String(raw)) = value else {
        return String::new();
    };
    let mut text = String::with_capacity(raw.len());
    let mut pending_space = false;
    for character in raw.chars() {
        if character <= '\u{001f}' || character == '\u{007f}' {
            pending_space = true;
            continue;
        }
        if is_js_whitespace(character) {
            pending_space = true;
            continue;
        }
        if pending_space && !text.is_empty() {
            text.push(' ');
        }
        pending_space = false;
        text.push(character);
    }
    text.chars().take(max).collect()
}

/// 对应 JS 的 `Number(value)`（只覆盖 JSON 能表达的值）。
pub fn js_number(value: &Value) -> f64 {
    match value {
        Value::Null => 0.0,
        Value::Bool(true) => 1.0,
        Value::Bool(false) => 0.0,
        Value::Number(number) => number.as_f64().unwrap_or(f64::NAN),
        Value::String(raw) => js_parse_number(raw),
        Value::Array(items) => {
            if items.is_empty() {
                0.0
            } else if items.len() == 1 {
                js_number(&items[0])
            } else {
                f64::NAN
            }
        }
        Value::Object(_) => f64::NAN,
    }
}

pub fn js_number_from_str(raw: &str) -> f64 {
    js_parse_number(raw)
}

fn js_parse_number(raw: &str) -> f64 {
    let text = raw.trim_matches(is_js_whitespace);
    if text.is_empty() {
        return 0.0;
    }
    let lowered = text.to_ascii_lowercase();
    match lowered.as_str() {
        "infinity" | "+infinity" => return f64::INFINITY,
        "-infinity" => return f64::NEG_INFINITY,
        "nan" | "inf" | "+inf" | "-inf" => return f64::NAN,
        _ => {}
    }
    if let Some(digits) = lowered
        .strip_prefix("0x")
        .or_else(|| lowered.strip_prefix("0b"))
        .or_else(|| lowered.strip_prefix("0o"))
    {
        let radix = match lowered.as_bytes()[1] {
            b'x' => 16,
            b'b' => 2,
            _ => 8,
        };
        return u64::from_str_radix(digits, radix)
            .map(|value| value as f64)
            .unwrap_or(f64::NAN);
    }
    text.parse::<f64>().unwrap_or(f64::NAN)
}

/// 对应 JS 的 `Number.isSafeInteger`（只看数值本身）。
pub fn is_safe_integer(value: f64) -> bool {
    value.is_finite() && value.fract() == 0.0 && value.abs() <= JS_MAX_SAFE_INTEGER
}

/// 只接受 JSON number（不接受字符串/布尔），对应 `Number.isSafeInteger(input.since)`。
pub fn json_safe_integer(value: &Value) -> Option<u64> {
    let Value::Number(number) = value else {
        return None;
    };
    let number = number.as_f64()?;
    if !is_safe_integer(number) || number < 0.0 {
        return None;
    }
    Some(number as u64)
}

/// 对应 room-protocol.js 的 `whole`：四舍五入后夹到 [min, max]。
pub fn whole(value: Option<&Value>, min: i64, max: i64, fallback: i64) -> i64 {
    let number = value.map(js_number).unwrap_or(f64::NAN);
    if !number.is_finite() {
        return fallback;
    }
    (number.round() as i64).clamp(min, max)
}

/// JSON 里整数不要输出成 `1.0`，和 Node 的 JSON.stringify 保持一致。
pub fn json_number(value: f64) -> Value {
    if !value.is_finite() {
        return Value::Null;
    }
    if value.fract() == 0.0 && value.abs() <= JS_MAX_SAFE_INTEGER {
        return Value::from(value as i64);
    }
    Number::from_f64(value)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

/// ISO-8601 UTC，带毫秒，和 Node 的 `Date#toISOString` 同形。
pub fn iso8601_now() -> String {
    format_timestamp(now_ms())
}

pub fn format_timestamp(ms: u64) -> String {
    let seconds = (ms / 1000) as i64;
    let millis = ms % 1000;
    let days = seconds.div_euclid(86_400);
    let second_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = second_of_day / 3_600;
    let minute = (second_of_day % 3_600) / 60;
    let second = second_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millis:03}Z")
}

/// Howard Hinnant 的 `civil_from_days`。
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let shifted = days + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = (shifted - era * 146_097) as u64;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era as i64 + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = (day_of_year - (153 * month_prime + 2) / 5 + 1) as u32;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    } as u32;
    (year + i64::from(month <= 2), month, day)
}

pub fn random_uuid_v4() -> String {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let encoded = hex::encode(bytes);
    format!(
        "{}-{}-{}-{}-{}",
        &encoded[0..8],
        &encoded[8..12],
        &encoded[12..16],
        &encoded[16..20],
        &encoded[20..32]
    )
}

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    OsRng.fill_bytes(&mut bytes);
    bytes
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn clean_text_collapses_controls_and_whitespace() {
        assert_eq!(
            clean_text(Some(&json!("  a\n\tb \u{0000} c  ")), 24),
            "a b c"
        );
        assert_eq!(clean_text(Some(&json!("甲乙丙")), 2), "甲乙");
        assert_eq!(clean_text(Some(&json!(42)), 24), "");
        assert_eq!(clean_text(None, 24), "");
    }

    #[test]
    fn js_number_matches_common_json_cases() {
        assert_eq!(js_number(&Value::Null), 0.0);
        assert_eq!(js_number(&json!(true)), 1.0);
        assert_eq!(js_number(&json!("")), 0.0);
        assert_eq!(js_number(&json!(" 1.5 ")), 1.5);
        assert_eq!(js_number(&json!("0x10")), 16.0);
        assert!(js_number(&json!("nope")).is_nan());
        assert!(js_number(&json!({})).is_nan());
        assert_eq!(js_number(&json!([7])), 7.0);
        assert!(js_number(&json!([1, 2])).is_nan());
    }

    #[test]
    fn whole_rounds_and_clamps() {
        assert_eq!(whole(Some(&json!(1.6)), 0, 100, 60), 2);
        assert_eq!(whole(Some(&json!(-3)), 0, 100, 60), 0);
        assert_eq!(whole(Some(&json!(999)), 0, 100, 60), 100);
        assert_eq!(whole(Some(&json!("bad")), 0, 100, 60), 60);
        assert_eq!(whole(None, 0, 100, 60), 60);
    }

    #[test]
    fn safe_integer_only_accepts_json_numbers() {
        assert_eq!(json_safe_integer(&json!(0)), Some(0));
        assert_eq!(json_safe_integer(&json!(1.0)), Some(1));
        assert_eq!(json_safe_integer(&json!(1e3)), Some(1_000));
        assert_eq!(json_safe_integer(&json!("0")), None);
        assert_eq!(json_safe_integer(&json!(true)), None);
        assert_eq!(json_safe_integer(&json!(-1)), None);
        assert_eq!(json_safe_integer(&json!(1.5)), None);
    }

    #[test]
    fn integer_json_numbers_do_not_gain_decimal_point() {
        assert_eq!(json_number(1.0).to_string(), "1");
        assert_eq!(json_number(0.5).to_string(), "0.5");
    }

    #[test]
    fn iso_timestamp_is_well_formed() {
        assert_eq!(format_timestamp(0), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            format_timestamp(1_700_000_000_123),
            "2023-11-14T22:13:20.123Z"
        );
    }

    #[test]
    fn uuid_has_version_and_variant() {
        let id = random_uuid_v4();
        assert_eq!(id.len(), 36);
        assert_eq!(&id[14..15], "4");
        assert!(matches!(&id[19..20], "8" | "9" | "a" | "b"));
    }
}
