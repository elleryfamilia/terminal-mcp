use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;
use tracing::{debug, error};

use super::protocol::{JsonRpcRequest, JsonRpcResponse};

/// STDIO transport for MCP JSON-RPC communication
pub struct StdioTransport {
    request_rx: mpsc::Receiver<JsonRpcRequest>,
    response_tx: mpsc::Sender<JsonRpcResponse>,
}

impl StdioTransport {
    /// Create a new STDIO transport and spawn reader/writer tasks
    pub fn new() -> (Self, StdioHandle) {
        let (request_tx, request_rx) = mpsc::channel(32);
        let (response_tx, response_rx) = mpsc::channel(32);

        let handle = StdioHandle {
            request_tx,
            response_rx,
        };

        let transport = Self {
            request_rx,
            response_tx,
        };

        (transport, handle)
    }

    /// Get the next request from stdin
    pub async fn recv(&mut self) -> Option<JsonRpcRequest> {
        self.request_rx.recv().await
    }

    /// Send a response to stdout
    pub async fn send(&self, response: JsonRpcResponse) -> Result<(), mpsc::error::SendError<JsonRpcResponse>> {
        self.response_tx.send(response).await
    }
}

/// Handle for the STDIO transport background tasks
pub struct StdioHandle {
    request_tx: mpsc::Sender<JsonRpcRequest>,
    response_rx: mpsc::Receiver<JsonRpcResponse>,
}

impl StdioHandle {
    /// Run the STDIO reader task (reads from stdin)
    pub async fn run_reader(self, mut response_rx: mpsc::Receiver<JsonRpcResponse>) {
        let stdin = tokio::io::stdin();
        let stdout = tokio::io::stdout();
        let mut reader = BufReader::new(stdin);
        let mut stdout = stdout;
        let mut line = String::new();

        loop {
            tokio::select! {
                // Read from stdin
                result = reader.read_line(&mut line) => {
                    match result {
                        Ok(0) => {
                            debug!("EOF on stdin, shutting down");
                            break;
                        }
                        Ok(_) => {
                            let trimmed = line.trim();
                            if trimmed.is_empty() {
                                line.clear();
                                continue;
                            }

                            debug!("Received: {}", trimmed);

                            match serde_json::from_str::<JsonRpcRequest>(trimmed) {
                                Ok(request) => {
                                    if self.request_tx.send(request).await.is_err() {
                                        error!("Failed to send request to handler");
                                        break;
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to parse JSON-RPC request: {}", e);
                                    // Send parse error response
                                    let error_response = JsonRpcResponse::error(
                                        None,
                                        super::protocol::JsonRpcError::parse_error(e.to_string()),
                                    );
                                    if let Ok(json) = serde_json::to_string(&error_response) {
                                        let _ = stdout.write_all(json.as_bytes()).await;
                                        let _ = stdout.write_all(b"\n").await;
                                        let _ = stdout.flush().await;
                                    }
                                }
                            }
                            line.clear();
                        }
                        Err(e) => {
                            error!("Error reading from stdin: {}", e);
                            break;
                        }
                    }
                }

                // Write to stdout
                Some(response) = response_rx.recv() => {
                    match serde_json::to_string(&response) {
                        Ok(json) => {
                            debug!("Sending: {}", json);
                            if let Err(e) = stdout.write_all(json.as_bytes()).await {
                                error!("Error writing to stdout: {}", e);
                                break;
                            }
                            if let Err(e) = stdout.write_all(b"\n").await {
                                error!("Error writing newline to stdout: {}", e);
                                break;
                            }
                            if let Err(e) = stdout.flush().await {
                                error!("Error flushing stdout: {}", e);
                                break;
                            }
                        }
                        Err(e) => {
                            error!("Failed to serialize response: {}", e);
                        }
                    }
                }
            }
        }
    }

    /// Split the handle into request sender and response receiver
    pub fn split(self) -> (mpsc::Sender<JsonRpcRequest>, mpsc::Receiver<JsonRpcResponse>) {
        (self.request_tx, self.response_rx)
    }
}

/// Run the STDIO transport loop
pub async fn run_stdio_loop(
    request_tx: mpsc::Sender<JsonRpcRequest>,
    mut response_rx: mpsc::Receiver<JsonRpcResponse>,
) {
    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();
    let mut reader = BufReader::new(stdin);
    let mut stdout = stdout;
    let mut line = String::new();

    loop {
        tokio::select! {
            // Read from stdin
            result = reader.read_line(&mut line) => {
                match result {
                    Ok(0) => {
                        debug!("EOF on stdin, shutting down");
                        break;
                    }
                    Ok(_) => {
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            line.clear();
                            continue;
                        }

                        debug!("Received: {}", trimmed);

                        match serde_json::from_str::<JsonRpcRequest>(trimmed) {
                            Ok(request) => {
                                if request_tx.send(request).await.is_err() {
                                    error!("Failed to send request to handler");
                                    break;
                                }
                            }
                            Err(e) => {
                                error!("Failed to parse JSON-RPC request: {}", e);
                                // Send parse error response
                                let error_response = JsonRpcResponse::error(
                                    None,
                                    super::protocol::JsonRpcError::parse_error(e.to_string()),
                                );
                                if let Ok(json) = serde_json::to_string(&error_response) {
                                    let _ = stdout.write_all(json.as_bytes()).await;
                                    let _ = stdout.write_all(b"\n").await;
                                    let _ = stdout.flush().await;
                                }
                            }
                        }
                        line.clear();
                    }
                    Err(e) => {
                        error!("Error reading from stdin: {}", e);
                        break;
                    }
                }
            }

            // Write to stdout
            Some(response) = response_rx.recv() => {
                match serde_json::to_string(&response) {
                    Ok(json) => {
                        debug!("Sending: {}", json);
                        if let Err(e) = stdout.write_all(json.as_bytes()).await {
                            error!("Error writing to stdout: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.write_all(b"\n").await {
                            error!("Error writing newline to stdout: {}", e);
                            break;
                        }
                        if let Err(e) = stdout.flush().await {
                            error!("Error flushing stdout: {}", e);
                            break;
                        }
                    }
                    Err(e) => {
                        error!("Failed to serialize response: {}", e);
                    }
                }
            }
        }
    }
}
