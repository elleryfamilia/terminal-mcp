mod mcp;
mod terminal;
mod tools;
mod utils;

use clap::Parser;
use tokio::sync::mpsc;
use tracing::{error, info};
use tracing_subscriber::EnvFilter;

use mcp::{McpServer, JsonRpcRequest, JsonRpcResponse};
use terminal::{Terminal, emulator::TerminalConfig};

/// Terminal MCP Server - A headless terminal emulator exposed via MCP
#[derive(Parser, Debug)]
#[command(name = "terminal-mcp")]
#[command(version, about, long_about = None)]
struct Args {
    /// Shell to use (default: $SHELL or /bin/bash)
    #[arg(short, long, env = "TERMINAL_MCP_SHELL")]
    shell: Option<String>,

    /// Terminal width in columns
    #[arg(short, long, default_value = "120", env = "TERMINAL_MCP_COLS")]
    cols: u16,

    /// Terminal height in rows
    #[arg(short, long, default_value = "40", env = "TERMINAL_MCP_ROWS")]
    rows: u16,

    /// Working directory for the shell
    #[arg(short, long, env = "TERMINAL_MCP_CWD")]
    working_dir: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(long, default_value = "info", env = "TERMINAL_MCP_LOG")]
    log_level: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Initialize tracing (logs to stderr, never stdout)
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&args.log_level));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(std::io::stderr)
        .with_ansi(false)
        .init();

    info!("Starting Terminal MCP Server v{}", env!("CARGO_PKG_VERSION"));

    // Create terminal configuration
    let config = TerminalConfig {
        shell: args.shell.unwrap_or_else(|| {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }),
        cols: args.cols,
        rows: args.rows,
        working_dir: args.working_dir,
    };

    info!("Terminal config: {:?}", config);

    // Create terminal
    let terminal = Terminal::new(config).map_err(|e| {
        error!("Failed to create terminal: {}", e);
        e
    })?;

    // Create MCP server
    let mut server = McpServer::new(terminal);

    // Set up channels for communication
    let (request_tx, mut request_rx) = mpsc::channel::<JsonRpcRequest>(32);
    let (response_tx, response_rx) = mpsc::channel::<JsonRpcResponse>(32);

    // Spawn the stdio transport loop
    tokio::spawn(async move {
        mcp::transport::run_stdio_loop(request_tx, response_rx).await;
    });

    info!("MCP server ready, waiting for requests");

    // Main request handling loop
    while let Some(request) = request_rx.recv().await {
        if let Some(response) = server.handle_request(request).await {
            if let Err(e) = response_tx.send(response).await {
                error!("Failed to send response: {}", e);
                break;
            }
        }
    }

    info!("MCP server shutting down");
    Ok(())
}
