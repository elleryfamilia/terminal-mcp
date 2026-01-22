use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, error, info};

use super::protocol::*;
use crate::terminal::Terminal;
use crate::tools;

/// MCP Server that handles JSON-RPC requests
pub struct McpServer {
    terminal: Arc<Mutex<Terminal>>,
    initialized: bool,
}

impl McpServer {
    /// Create a new MCP server with a terminal
    pub fn new(terminal: Terminal) -> Self {
        Self {
            terminal: Arc::new(Mutex::new(terminal)),
            initialized: false,
        }
    }

    /// Handle an incoming JSON-RPC request and return a response
    pub async fn handle_request(&mut self, request: JsonRpcRequest) -> Option<JsonRpcResponse> {
        debug!("Handling method: {}", request.method);

        // Handle notifications (no id) differently
        let is_notification = request.id.is_none();

        let result = match request.method.as_str() {
            "initialize" => self.handle_initialize(request.params).await,
            "initialized" => {
                // This is a notification, no response needed
                self.initialized = true;
                info!("MCP server initialized");
                return None;
            }
            "ping" => Ok(serde_json::json!({})),
            "tools/list" => self.handle_tools_list().await,
            "tools/call" => self.handle_tools_call(request.params).await,
            "notifications/cancelled" => {
                // Handle cancellation notification
                debug!("Received cancellation notification");
                return None;
            }
            method => Err(JsonRpcError::method_not_found(method)),
        };

        // Don't send response for notifications
        if is_notification {
            return None;
        }

        Some(match result {
            Ok(value) => JsonRpcResponse::success(request.id, value),
            Err(error) => JsonRpcResponse::error(request.id, error),
        })
    }

    /// Handle the initialize request
    async fn handle_initialize(&mut self, params: Option<Value>) -> Result<Value, JsonRpcError> {
        let _params: InitializeParams = params
            .map(|p| serde_json::from_value(p))
            .transpose()
            .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?
            .ok_or_else(|| JsonRpcError::invalid_params("Missing initialize params"))?;

        info!("Initializing MCP server");

        let result = InitializeResult {
            protocol_version: MCP_PROTOCOL_VERSION.to_string(),
            capabilities: ServerCapabilities {
                tools: ToolsCapability { list_changed: false },
            },
            server_info: ServerInfo {
                name: "terminal-mcp".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
        };

        Ok(serde_json::to_value(result).unwrap())
    }

    /// Handle tools/list request
    async fn handle_tools_list(&self) -> Result<Value, JsonRpcError> {
        let tools = tools::get_tool_definitions();
        let result = ToolsListResult { tools };
        Ok(serde_json::to_value(result).unwrap())
    }

    /// Handle tools/call request
    async fn handle_tools_call(&self, params: Option<Value>) -> Result<Value, JsonRpcError> {
        let params: CallToolParams = params
            .map(|p| serde_json::from_value(p))
            .transpose()
            .map_err(|e| JsonRpcError::invalid_params(e.to_string()))?
            .ok_or_else(|| JsonRpcError::invalid_params("Missing call params"))?;

        debug!("Calling tool: {}", params.name);

        let mut terminal = self.terminal.lock().await;
        let args = params.arguments.unwrap_or(Value::Object(serde_json::Map::new()));

        let result = match params.name.as_str() {
            "type" => tools::type_text(&mut terminal, args),
            "sendKey" => tools::send_key(&mut terminal, args),
            "getContent" => tools::get_content(&mut terminal, args),
            "takeScreenshot" => tools::take_screenshot(&mut terminal, args),
            "clear" => tools::clear(&mut terminal, args),
            name => {
                return Err(JsonRpcError::invalid_params(format!(
                    "Unknown tool: {}",
                    name
                )));
            }
        };

        match result {
            Ok(call_result) => Ok(serde_json::to_value(call_result).unwrap()),
            Err(e) => {
                error!("Tool error: {}", e);
                let error_result = CallToolResult::error(e.to_string());
                Ok(serde_json::to_value(error_result).unwrap())
            }
        }
    }
}
