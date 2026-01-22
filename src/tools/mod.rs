pub mod clear;
pub mod get_content;
pub mod screenshot;
pub mod send_key;
pub mod type_text;

pub use clear::clear;
pub use get_content::get_content;
pub use screenshot::take_screenshot;
pub use send_key::send_key;
pub use type_text::type_text;

use crate::mcp::ToolDefinition;

/// Returns all available tool definitions
pub fn get_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        type_text::definition(),
        send_key::definition(),
        get_content::definition(),
        screenshot::definition(),
        clear::definition(),
    ]
}
