use std::io::Read;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use thiserror::Error;
use tracing::{debug, error, info};
use vt100::Parser;

use super::pty::{Pty, PtyConfig, PtyError};

/// Terminal-related errors
#[derive(Error, Debug)]
pub enum TerminalError {
    #[error("PTY error: {0}")]
    Pty(#[from] PtyError),
    #[error("Terminal not ready")]
    NotReady,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Configuration for the terminal
#[derive(Debug, Clone)]
pub struct TerminalConfig {
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub working_dir: Option<String>,
}

impl Default for TerminalConfig {
    fn default() -> Self {
        Self {
            shell: std::env::var("TERMINAL_MCP_SHELL")
                .or_else(|_| std::env::var("SHELL"))
                .unwrap_or_else(|_| "/bin/bash".to_string()),
            cols: std::env::var("TERMINAL_MCP_COLS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(120),
            rows: std::env::var("TERMINAL_MCP_ROWS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(40),
            working_dir: std::env::var("TERMINAL_MCP_CWD").ok(),
        }
    }
}

/// Terminal emulator combining PTY and vt100 parser
pub struct Terminal {
    pty: Pty,
    parser: Parser,
    output_rx: mpsc::Receiver<Vec<u8>>,
}

impl Terminal {
    /// Create a new terminal with the given configuration
    pub fn new(config: TerminalConfig) -> Result<Self, TerminalError> {
        let pty_config = PtyConfig {
            shell: config.shell.clone(),
            cols: config.cols,
            rows: config.rows,
            working_dir: config.working_dir,
            env: Vec::new(),
        };

        let mut pty = Pty::new(pty_config)?;
        let parser = Parser::new(config.rows, config.cols, 1000); // 1000 lines of scrollback

        // Set up background reader thread
        let mut reader = pty.take_reader();
        let (output_tx, output_rx) = mpsc::channel();

        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        debug!("PTY reader EOF");
                        break;
                    }
                    Ok(n) => {
                        if output_tx.send(buf[..n].to_vec()).is_err() {
                            debug!("Output channel closed");
                            break;
                        }
                    }
                    Err(e) => {
                        error!("PTY read error: {}", e);
                        break;
                    }
                }
            }
        });

        info!(
            "Terminal created with shell: {}, size: {}x{}",
            config.shell, config.cols, config.rows
        );

        Ok(Self {
            pty,
            parser,
            output_rx,
        })
    }

    /// Create a terminal with default configuration
    pub fn with_defaults() -> Result<Self, TerminalError> {
        Self::new(TerminalConfig::default())
    }

    /// Process any pending output from the PTY
    pub fn process_output(&mut self) {
        // Drain all available output
        while let Ok(data) = self.output_rx.try_recv() {
            self.parser.process(&data);
        }
    }

    /// Process output with a timeout, waiting for data to arrive
    pub fn process_output_with_timeout(&mut self, timeout: Duration) {
        // First drain any immediately available data
        self.process_output();

        // Then wait for more data with timeout
        if let Ok(data) = self.output_rx.recv_timeout(timeout) {
            self.parser.process(&data);
            // Drain any additional data that arrived
            self.process_output();
        }
    }

    /// Write text to the terminal
    pub fn write(&mut self, data: &[u8]) -> Result<usize, TerminalError> {
        Ok(self.pty.write(data)?)
    }

    /// Write a string to the terminal
    pub fn write_str(&mut self, text: &str) -> Result<usize, TerminalError> {
        self.write(text.as_bytes())
    }

    /// Send special key sequence to the terminal
    pub fn send_key(&mut self, key: &str) -> Result<(), TerminalError> {
        let sequence = crate::utils::keys::key_to_sequence(key);
        self.write(sequence.as_bytes())?;
        Ok(())
    }

    /// Get the current screen content as plain text
    pub fn get_content(&mut self) -> String {
        self.process_output();
        let screen = self.parser.screen();
        screen.contents()
    }

    /// Get the current screen content as plain text with specific range
    pub fn get_content_range(&mut self, start_row: u16, end_row: u16) -> String {
        self.process_output();
        let screen = self.parser.screen();
        let mut content = String::new();

        let (_, rows) = self.size();
        let end = end_row.min(rows);

        for row in start_row..end {
            let row_content = screen.contents_between(row, 0, row, screen.size().1);
            content.push_str(&row_content);
            if row < end - 1 {
                content.push('\n');
            }
        }

        content
    }

    /// Get the current screen as ANSI text (with escape sequences for colors)
    pub fn take_screenshot(&mut self) -> String {
        self.process_output();
        let screen = self.parser.screen();

        let mut output = String::new();
        let (cols, rows) = (screen.size().1, screen.size().0);

        for row in 0..rows {
            let mut current_attrs: Option<vt100::Cell> = None;

            for col in 0..cols {
                let cell = screen.cell(row, col).unwrap();

                // Check if we need to emit new attributes
                if current_attrs.as_ref().map(|c| !cells_same_style(c, &cell)).unwrap_or(true) {
                    // Reset and apply new attributes
                    output.push_str("\x1b[0m");
                    output.push_str(&cell_to_ansi(&cell));
                    current_attrs = Some(cell.clone());
                }

                output.push(cell.contents().chars().next().unwrap_or(' '));
            }

            // Reset at end of line and add newline
            output.push_str("\x1b[0m");
            if row < rows - 1 {
                output.push('\n');
            }
        }

        output
    }

    /// Clear the terminal screen
    pub fn clear(&mut self) -> Result<(), TerminalError> {
        // Send clear screen escape sequence and move cursor to home
        self.write(b"\x1b[2J\x1b[H")?;
        Ok(())
    }

    /// Get cursor position
    pub fn cursor_position(&mut self) -> (u16, u16) {
        self.process_output();
        let screen = self.parser.screen();
        let pos = screen.cursor_position();
        (pos.0, pos.1)
    }

    /// Resize the terminal
    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), TerminalError> {
        self.pty.resize(cols, rows)?;
        self.parser.set_size(rows, cols);
        info!("Terminal resized to {}x{}", cols, rows);
        Ok(())
    }

    /// Get terminal size
    pub fn size(&self) -> (u16, u16) {
        self.pty.size()
    }
}

/// Check if two cells have the same style (ignoring content)
fn cells_same_style(a: &vt100::Cell, b: &vt100::Cell) -> bool {
    a.fgcolor() == b.fgcolor()
        && a.bgcolor() == b.bgcolor()
        && a.bold() == b.bold()
        && a.italic() == b.italic()
        && a.underline() == b.underline()
        && a.inverse() == b.inverse()
}

/// Convert cell attributes to ANSI escape sequence
fn cell_to_ansi(cell: &vt100::Cell) -> String {
    let mut codes = Vec::new();

    if cell.bold() {
        codes.push("1".to_string());
    }
    if cell.italic() {
        codes.push("3".to_string());
    }
    if cell.underline() {
        codes.push("4".to_string());
    }
    if cell.inverse() {
        codes.push("7".to_string());
    }

    // Foreground color
    match cell.fgcolor() {
        vt100::Color::Default => {}
        vt100::Color::Idx(idx) => {
            if idx < 8 {
                codes.push(format!("{}", 30 + idx));
            } else if idx < 16 {
                codes.push(format!("{}", 90 + idx - 8));
            } else {
                codes.push(format!("38;5;{}", idx));
            }
        }
        vt100::Color::Rgb(r, g, b) => {
            codes.push(format!("38;2;{};{};{}", r, g, b));
        }
    }

    // Background color
    match cell.bgcolor() {
        vt100::Color::Default => {}
        vt100::Color::Idx(idx) => {
            if idx < 8 {
                codes.push(format!("{}", 40 + idx));
            } else if idx < 16 {
                codes.push(format!("{}", 100 + idx - 8));
            } else {
                codes.push(format!("48;5;{}", idx));
            }
        }
        vt100::Color::Rgb(r, g, b) => {
            codes.push(format!("48;2;{};{};{}", r, g, b));
        }
    }

    if codes.is_empty() {
        String::new()
    } else {
        format!("\x1b[{}m", codes.join(";"))
    }
}
