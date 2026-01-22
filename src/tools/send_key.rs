use serde::Deserialize;
use serde_json::Value;

use crate::mcp::{CallToolResult, ToolDefinition};
use crate::terminal::Terminal;

/// Arguments for the sendKey tool
#[derive(Debug, Deserialize)]
pub struct SendKeyArgs {
    /// The key to send (e.g., "Enter", "Tab", "Ctrl+C", "Up")
    pub key: String,
}

/// Send a special key or key combination to the terminal
pub fn send_key(terminal: &mut Terminal, args: Value) -> Result<CallToolResult, String> {
    let args: SendKeyArgs = serde_json::from_value(args)
        .map_err(|e| format!("Invalid arguments: {}", e))?;

    terminal
        .send_key(&args.key)
        .map_err(|e| format!("Failed to send key: {}", e))?;

    Ok(CallToolResult::text(format!("Sent key: {}", args.key)))
}

/// Get the tool definition for sendKey
pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "sendKey".to_string(),
        description: "Send a special key or key combination to the terminal. Supports keys like Enter, Tab, Escape, arrow keys (Up, Down, Left, Right), function keys (F1-F12), and control combinations (Ctrl+C, Ctrl+D, etc.).".to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "The key to send. Examples: 'Enter', 'Tab', 'Escape', 'Up', 'Down', 'Left', 'Right', 'Ctrl+C', 'Ctrl+D', 'Ctrl+Z', 'F1', 'Home', 'End', 'PageUp', 'PageDown', 'Backspace', 'Delete'"
                }
            },
            "required": ["key"]
        }),
    }
}
