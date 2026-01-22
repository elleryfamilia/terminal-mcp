/// Key code enumeration for special keys
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum KeyCode {
    Enter,
    Tab,
    Escape,
    Backspace,
    Delete,
    Up,
    Down,
    Left,
    Right,
    Home,
    End,
    PageUp,
    PageDown,
    Insert,
    F1,
    F2,
    F3,
    F4,
    F5,
    F6,
    F7,
    F8,
    F9,
    F10,
    F11,
    F12,
    // Ctrl combinations
    CtrlA,
    CtrlB,
    CtrlC,
    CtrlD,
    CtrlE,
    CtrlF,
    CtrlG,
    CtrlH,
    CtrlI,
    CtrlJ,
    CtrlK,
    CtrlL,
    CtrlM,
    CtrlN,
    CtrlO,
    CtrlP,
    CtrlQ,
    CtrlR,
    CtrlS,
    CtrlT,
    CtrlU,
    CtrlV,
    CtrlW,
    CtrlX,
    CtrlY,
    CtrlZ,
    CtrlBackslash,
    CtrlBracket,
    CtrlCaret,
    CtrlUnderscore,
}

/// Convert a key name to its ANSI escape sequence
pub fn key_to_sequence(key: &str) -> String {
    match key.to_lowercase().as_str() {
        // Basic keys
        "enter" | "return" => "\r".to_string(),
        "tab" => "\t".to_string(),
        "escape" | "esc" => "\x1b".to_string(),
        "backspace" => "\x7f".to_string(),
        "delete" | "del" => "\x1b[3~".to_string(),
        "space" => " ".to_string(),

        // Arrow keys
        "up" | "arrowup" => "\x1b[A".to_string(),
        "down" | "arrowdown" => "\x1b[B".to_string(),
        "right" | "arrowright" => "\x1b[C".to_string(),
        "left" | "arrowleft" => "\x1b[D".to_string(),

        // Navigation keys
        "home" => "\x1b[H".to_string(),
        "end" => "\x1b[F".to_string(),
        "pageup" | "pgup" => "\x1b[5~".to_string(),
        "pagedown" | "pgdn" => "\x1b[6~".to_string(),
        "insert" | "ins" => "\x1b[2~".to_string(),

        // Function keys
        "f1" => "\x1bOP".to_string(),
        "f2" => "\x1bOQ".to_string(),
        "f3" => "\x1bOR".to_string(),
        "f4" => "\x1bOS".to_string(),
        "f5" => "\x1b[15~".to_string(),
        "f6" => "\x1b[17~".to_string(),
        "f7" => "\x1b[18~".to_string(),
        "f8" => "\x1b[19~".to_string(),
        "f9" => "\x1b[20~".to_string(),
        "f10" => "\x1b[21~".to_string(),
        "f11" => "\x1b[23~".to_string(),
        "f12" => "\x1b[24~".to_string(),

        // Ctrl combinations
        "ctrl+a" | "ctrl-a" | "c-a" => "\x01".to_string(),
        "ctrl+b" | "ctrl-b" | "c-b" => "\x02".to_string(),
        "ctrl+c" | "ctrl-c" | "c-c" => "\x03".to_string(),
        "ctrl+d" | "ctrl-d" | "c-d" => "\x04".to_string(),
        "ctrl+e" | "ctrl-e" | "c-e" => "\x05".to_string(),
        "ctrl+f" | "ctrl-f" | "c-f" => "\x06".to_string(),
        "ctrl+g" | "ctrl-g" | "c-g" => "\x07".to_string(),
        "ctrl+h" | "ctrl-h" | "c-h" => "\x08".to_string(),
        "ctrl+i" | "ctrl-i" | "c-i" => "\x09".to_string(),
        "ctrl+j" | "ctrl-j" | "c-j" => "\x0a".to_string(),
        "ctrl+k" | "ctrl-k" | "c-k" => "\x0b".to_string(),
        "ctrl+l" | "ctrl-l" | "c-l" => "\x0c".to_string(),
        "ctrl+m" | "ctrl-m" | "c-m" => "\x0d".to_string(),
        "ctrl+n" | "ctrl-n" | "c-n" => "\x0e".to_string(),
        "ctrl+o" | "ctrl-o" | "c-o" => "\x0f".to_string(),
        "ctrl+p" | "ctrl-p" | "c-p" => "\x10".to_string(),
        "ctrl+q" | "ctrl-q" | "c-q" => "\x11".to_string(),
        "ctrl+r" | "ctrl-r" | "c-r" => "\x12".to_string(),
        "ctrl+s" | "ctrl-s" | "c-s" => "\x13".to_string(),
        "ctrl+t" | "ctrl-t" | "c-t" => "\x14".to_string(),
        "ctrl+u" | "ctrl-u" | "c-u" => "\x15".to_string(),
        "ctrl+v" | "ctrl-v" | "c-v" => "\x16".to_string(),
        "ctrl+w" | "ctrl-w" | "c-w" => "\x17".to_string(),
        "ctrl+x" | "ctrl-x" | "c-x" => "\x18".to_string(),
        "ctrl+y" | "ctrl-y" | "c-y" => "\x19".to_string(),
        "ctrl+z" | "ctrl-z" | "c-z" => "\x1a".to_string(),
        "ctrl+[" | "ctrl-[" => "\x1b".to_string(),
        "ctrl+\\" | "ctrl-\\" => "\x1c".to_string(),
        "ctrl+]" | "ctrl-]" => "\x1d".to_string(),
        "ctrl+^" | "ctrl-^" => "\x1e".to_string(),
        "ctrl+_" | "ctrl-_" => "\x1f".to_string(),

        // Alt/Meta combinations (send escape prefix)
        key if key.starts_with("alt+") || key.starts_with("alt-") || key.starts_with("m-") => {
            let char_part = key
                .strip_prefix("alt+")
                .or_else(|| key.strip_prefix("alt-"))
                .or_else(|| key.strip_prefix("m-"))
                .unwrap_or("");
            format!("\x1b{}", char_part)
        }

        // Unknown key - return as-is
        other => other.to_string(),
    }
}

/// Parse a key combination string into its components
pub fn parse_key_combo(combo: &str) -> Vec<String> {
    combo
        .split('+')
        .map(|s| s.trim().to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_keys() {
        assert_eq!(key_to_sequence("enter"), "\r");
        assert_eq!(key_to_sequence("tab"), "\t");
        assert_eq!(key_to_sequence("escape"), "\x1b");
    }

    #[test]
    fn test_arrow_keys() {
        assert_eq!(key_to_sequence("up"), "\x1b[A");
        assert_eq!(key_to_sequence("down"), "\x1b[B");
        assert_eq!(key_to_sequence("right"), "\x1b[C");
        assert_eq!(key_to_sequence("left"), "\x1b[D");
    }

    #[test]
    fn test_ctrl_keys() {
        assert_eq!(key_to_sequence("ctrl+c"), "\x03");
        assert_eq!(key_to_sequence("ctrl-c"), "\x03");
        assert_eq!(key_to_sequence("c-c"), "\x03");
    }

    #[test]
    fn test_function_keys() {
        assert_eq!(key_to_sequence("f1"), "\x1bOP");
        assert_eq!(key_to_sequence("f12"), "\x1b[24~");
    }

    #[test]
    fn test_case_insensitive() {
        assert_eq!(key_to_sequence("ENTER"), "\r");
        assert_eq!(key_to_sequence("Enter"), "\r");
        assert_eq!(key_to_sequence("CTRL+C"), "\x03");
    }
}
