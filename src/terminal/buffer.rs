/// Buffer utility functions for terminal content manipulation

/// Strip ANSI escape sequences from text
pub fn strip_ansi(text: &str) -> String {
    let mut result = String::new();
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Skip escape sequence
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                // Skip until we hit a letter
                while let Some(&next) = chars.peek() {
                    chars.next();
                    if next.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            result.push(c);
        }
    }

    result
}

/// Trim trailing whitespace from each line while preserving structure
pub fn trim_trailing_whitespace(text: &str) -> String {
    text.lines()
        .map(|line| line.trim_end())
        .collect::<Vec<_>>()
        .join("\n")
}

/// Remove empty lines from the end of text
pub fn trim_trailing_empty_lines(text: &str) -> String {
    let lines: Vec<&str> = text.lines().collect();
    let mut end = lines.len();

    while end > 0 && lines[end - 1].trim().is_empty() {
        end -= 1;
    }

    lines[..end].join("\n")
}

/// Clean terminal output by removing trailing whitespace and empty lines
pub fn clean_output(text: &str) -> String {
    let trimmed = trim_trailing_whitespace(text);
    trim_trailing_empty_lines(&trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi() {
        assert_eq!(strip_ansi("\x1b[31mred\x1b[0m"), "red");
        assert_eq!(strip_ansi("\x1b[1;32mbold green\x1b[0m"), "bold green");
        assert_eq!(strip_ansi("no escapes"), "no escapes");
    }

    #[test]
    fn test_trim_trailing_whitespace() {
        assert_eq!(trim_trailing_whitespace("hello   \nworld  "), "hello\nworld");
    }

    #[test]
    fn test_trim_trailing_empty_lines() {
        assert_eq!(trim_trailing_empty_lines("hello\n\n\n"), "hello");
        assert_eq!(trim_trailing_empty_lines("hello\nworld\n\n"), "hello\nworld");
    }

    #[test]
    fn test_clean_output() {
        assert_eq!(clean_output("hello   \nworld  \n\n\n"), "hello\nworld");
    }
}
