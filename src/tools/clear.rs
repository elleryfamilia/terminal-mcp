use serde::Deserialize;
use serde_json::Value;

use crate::mcp::{CallToolResult, ToolDefinition};
use crate::terminal::Terminal;

/// Arguments for the clear tool (currently none)
#[derive(Debug, Deserialize, Default)]
pub struct ClearArgs {}

/// Clear the terminal screen
pub fn clear(terminal: &mut Terminal, args: Value) -> Result<CallToolResult, String> {
    let _args: ClearArgs = serde_json::from_value(args).unwrap_or_default();

    terminal
        .clear()
        .map_err(|e| format!("Failed to clear terminal: {}", e))?;

    Ok(CallToolResult::text("Terminal cleared"))
}

/// Get the tool definition for clear
pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "clear".to_string(),
        description: "Clear the terminal screen and move cursor to the top-left position.".to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {}
        }),
    }
}
