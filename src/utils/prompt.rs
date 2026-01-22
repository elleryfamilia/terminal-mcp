use regex::Regex;

/// Common shell prompt patterns
pub const DEFAULT_PROMPT_PATTERNS: &[&str] = &[
    r"^\s*[\$#>]\s*$",           // Basic $ # > prompts
    r"^\s*\w+@[\w.-]+[:\s].*[\$#>]\s*$", // user@host:path$ style
    r"^\s*\(.*\)\s*[\$#>]\s*$",  // (venv) $ style
    r"^\s*\[.*\]\s*[\$#>]\s*$",  // [user@host path]$ style
    r"^\s*➜\s*",                 // Oh-my-zsh arrow style
    r"^\s*❯\s*",                 // Pure prompt style
    r"^\s*λ\s*",                 // Lambda style
];

/// Prompt detector for determining when a command has completed
pub struct PromptDetector {
    patterns: Vec<Regex>,
}

impl PromptDetector {
    /// Create a new prompt detector with default patterns
    pub fn new() -> Self {
        Self::with_patterns(DEFAULT_PROMPT_PATTERNS)
    }

    /// Create a prompt detector with custom patterns
    pub fn with_patterns(patterns: &[&str]) -> Self {
        let patterns = patterns
            .iter()
            .filter_map(|p| Regex::new(p).ok())
            .collect();
        Self { patterns }
    }

    /// Add a custom prompt pattern
    pub fn add_pattern(&mut self, pattern: &str) -> Result<(), regex::Error> {
        let regex = Regex::new(pattern)?;
        self.patterns.push(regex);
        Ok(())
    }

    /// Check if the given line looks like a shell prompt
    pub fn is_prompt(&self, line: &str) -> bool {
        self.patterns.iter().any(|p| p.is_match(line))
    }

    /// Check if the last line of output looks like a prompt
    pub fn ends_with_prompt(&self, output: &str) -> bool {
        output
            .lines()
            .last()
            .map(|line| self.is_prompt(line))
            .unwrap_or(false)
    }
}

impl Default for PromptDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_prompts() {
        let detector = PromptDetector::new();

        assert!(detector.is_prompt("$ "));
        assert!(detector.is_prompt("# "));
        assert!(detector.is_prompt("> "));
    }

    #[test]
    fn test_user_host_prompt() {
        let detector = PromptDetector::new();

        assert!(detector.is_prompt("user@host:~$ "));
        assert!(detector.is_prompt("root@server:/var/log# "));
    }

    #[test]
    fn test_ends_with_prompt() {
        let detector = PromptDetector::new();

        let output = "some output\nmore output\nuser@host:~$ ";
        assert!(detector.ends_with_prompt(output));

        let output_no_prompt = "some output\nmore output";
        assert!(!detector.ends_with_prompt(output_no_prompt));
    }
}
