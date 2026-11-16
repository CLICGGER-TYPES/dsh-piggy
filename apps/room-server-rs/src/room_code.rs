//! 房间码：4 位，字符集去掉 0/O/1/I，显示成 PIG-XXXX。

use crate::util::{is_js_whitespace, random_bytes};

pub const ROOM_CODE_ALPHABET: &[u8; 32] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
pub const ROOM_CODE_LENGTH: usize = 4;
pub const ROOM_CODE_DISPLAY_PREFIX: &str = "PIG-";

pub fn generate_room_code() -> String {
    let bytes: [u8; ROOM_CODE_LENGTH] = random_bytes();
    bytes
        .iter()
        .map(|byte| ROOM_CODE_ALPHABET[*byte as usize % ROOM_CODE_ALPHABET.len()] as char)
        .collect()
}

/// 接受 `7K2M`、`PIG-7K2M`、`pig 7k2m` 这类写法；不合法返回 None。
pub fn normalize_room_code(value: &str) -> Option<String> {
    let trimmed = value.trim_matches(is_js_whitespace);
    let mut upper = String::with_capacity(trimmed.len());
    for character in trimmed.chars() {
        for converted in character.to_uppercase() {
            upper.push(converted);
        }
    }

    let mut compact = String::with_capacity(upper.len());
    let mut in_separator = false;
    for character in upper.chars() {
        if is_js_whitespace(character) || character == '_' || character == '-' {
            in_separator = true;
            continue;
        }
        if in_separator {
            in_separator = false;
        }
        compact.push(character);
    }

    let mut text = compact.as_str();
    if text.starts_with("PIG") && text.chars().count() > 3 {
        text = &text[3..];
    }
    if text.chars().count() != ROOM_CODE_LENGTH {
        return None;
    }
    if text.bytes().all(|byte| ROOM_CODE_ALPHABET.contains(&byte)) {
        Some(text.to_string())
    } else {
        None
    }
}

pub fn format_room_code(code: &str) -> String {
    format!("{ROOM_CODE_DISPLAY_PREFIX}{code}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_codes_use_the_alphabet() {
        for _ in 0..64 {
            let code = generate_room_code();
            assert_eq!(code.len(), ROOM_CODE_LENGTH);
            assert!(code.bytes().all(|byte| ROOM_CODE_ALPHABET.contains(&byte)));
        }
    }

    #[test]
    fn normalization_accepts_common_forms() {
        assert_eq!(normalize_room_code("7K2M").as_deref(), Some("7K2M"));
        assert_eq!(
            normalize_room_code("p i g 7 k 2 m").as_deref(),
            Some("7K2M")
        );
        assert_eq!(normalize_room_code("PIG-7k2m").as_deref(), Some("7K2M"));
        assert_eq!(normalize_room_code("pig_7k2m").as_deref(), Some("7K2M"));
        assert_eq!(normalize_room_code("  PIG 7K2M  ").as_deref(), Some("7K2M"));
    }

    #[test]
    fn normalization_rejects_bad_codes() {
        assert_eq!(normalize_room_code(""), None);
        assert_eq!(normalize_room_code("7K2"), None);
        assert_eq!(normalize_room_code("7K2MO"), None);
        assert_eq!(normalize_room_code("0O1I"), None);
        assert_eq!(normalize_room_code("7K2М"), None);
        assert_eq!(normalize_room_code("PIG-PIG7K2M"), None);
    }

    #[test]
    fn display_prefix_is_stable() {
        assert_eq!(format_room_code("7K2M"), "PIG-7K2M");
    }
}
