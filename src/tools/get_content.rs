use serde::Deserialize;
use serde_json::Value;

use crate::mcp::{CallToolResult, ToolDefinition};
use crate::terminal::Terminal;
use crate::terminal::buffer;

/// Arguments for the getContent tool
#[derive(Debug, Deserialize, Default)]
pub struct GetContentArgs {
    /// Starting row (0-indexed, optional)
    #[serde(default)]
    pub start_row: Option<u16>,
    /// Ending row (exclusive, optional)
    #[serde(default)]
    pub end_row: Option<u16>,
    /// Whether to include trailing whitespace (default: false)
    #[serde(default)]
    pub include_trailing_whitespace: bool,
}

/// Get the terminal buffer content as plain text
pub fn get_content(terminal: &mut Terminal, args: Value) -> Result<CallToolResult, String> {
    let args: GetContentArgs = serde_json::from_value(args).unwrap_or_default();

    let content = match (args.start_row, args.end_row) {
        (Some(start), Some(end)) => terminal.get_content_range(start, end),
        (Some(start), None) => {
            let (_, rows) = terminal.size();
            terminal.get_content_range(start, rows)
        }
        (None, Some(end)) => terminal.get_content_range(0, end),
        (None, None) => terminal.get_content(),
    };

    let content = if args.include_trailing_whitespace {
        content
    } else {
        buffer::clean_output(&content)
    };

    Ok(CallToolResult::text(content))
}

/// Get the tool definition for getContent
pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "getContent".to_string(),
        description: "Get the current terminal buffer content as plain text. Returns the visible screen content without ANSI escape codes.".to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "start_row": {
                    "type": "integer",
                    "description": "Starting row (0-indexed). If not specified, starts from the first row.",
                    "minimum": 0
                },
                "end_row": {
                    "type": "integer",
                    "description": "Ending row (exclusive). If not specified, includes all rows to the end.",
                    "minimum": 0
                },
                "include_trailing_whitespace": {
                    "type": "boolean",
                    "description": "Whether to include trailing whitespace in the output. Default is false.",
                    "default": false
                }
            }
        }),
    }
}
