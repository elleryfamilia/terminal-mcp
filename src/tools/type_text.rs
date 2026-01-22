use serde::Deserialize;
use serde_json::Value;

use crate::mcp::{CallToolResult, ToolDefinition};
use crate::terminal::Terminal;

/// Arguments for the type tool
#[derive(Debug, Deserialize)]
pub struct TypeArgs {
    /// The text to type into the terminal
    pub text: String,
}

/// Send text input to the terminal
pub fn type_text(terminal: &mut Terminal, args: Value) -> Result<CallToolResult, String> {
    let args: TypeArgs = serde_json::from_value(args)
        .map_err(|e| format!("Invalid arguments: {}", e))?;

    terminal
        .write_str(&args.text)
        .map_err(|e| format!("Failed to write to terminal: {}", e))?;

    Ok(CallToolResult::text(format!(
        "Typed {} characters",
        args.text.len()
    )))
}

/// Get the tool definition for type
pub fn definition() -> ToolDefinition {
    ToolDefinition {
        name: "type".to_string(),
        description: "Send text input to the terminal. The text is written directly to the terminal as if typed by a user.".to_string(),
        input_schema: serde_json::json!({
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The text to type into the terminal"
                }
            },
            "required": ["text"]
        }),
    }
}
