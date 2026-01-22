use serde::Deserialize;
use serde_json::Value;

use crate::mcp::{CallToolResult, ToolDefinition};
use crate::terminal::Terminal;

/// Arguments for the takeScreenshot tool
#[derive(Debug, Deserialize, Default)]
pub struct ScreenshotArgs {
    /// Format of the screenshot: "ansi" (default) or "plain"
    #[serde(default)]
    pub format: Option<String>,
}

/// Take a screenshot of the terminal, optionally with ANSI colors
pub fn take_screenshot(terminal: &mut Terminal, args: Value) -> Result<CallToolResult, String> {
    let args: ScreenshotArgs = serde_json::from_value(args).unwrap_or_default();

    let format = args.format.as_deref().unwrap_or("ansi");

    let content = match format {
        "plain" => terminal.get_content(),
        "ansi" | _ => terminal.take_screenshot(),
    };

    // Get cursor position for additional context
    let (row, col) = terminal.cursor_position();
    let (cols, rows) = terminal.size();

    // Build a header with terminal info
    let header = format!(
        "Terminal: {}x{} | Cursor: ({}, {})\n{}\n",
        cols, rows, row, col,
        "─".repeat(cols as usize)
    );

    Ok(CallToolResult::text(format!("{}{}", header, content)))
}

/// Get the tool definition for takeScreenshot
pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "takeScreenshot".to_string(),
        description: "Capture the current terminal state as text. By default includes ANSI escape codes for colors and formatting. Use format='plain' for plain text without escape codes.".to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "format": {
                    "type": "string",
                    "description": "Output format: 'ansi' (default) includes color codes, 'plain' is plain text only",
                    "enum": ["ansi", "plain"],
                    "default": "ansi"
                }
            }
        }),
    }
}
