use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::io::{Read, Write};
use thiserror::Error;
use tracing::{debug, error, info};

/// PTY-related errors
#[derive(Error, Debug)]
pub enum PtyError {
    #[error("Failed to create PTY: {0}")]
    CreateError(String),
    #[error("Failed to spawn process: {0}")]
    SpawnError(String),
    #[error("Failed to write to PTY: {0}")]
    WriteError(#[from] std::io::Error),
    #[error("Failed to resize PTY: {0}")]
    ResizeError(String),
}

/// Configuration for PTY creation
#[derive(Debug, Clone)]
pub struct PtyConfig {
    pub shell: String,
    pub cols: u16,
    pub rows: u16,
    pub working_dir: Option<String>,
    pub env: Vec<(String, String)>,
}

impl Default for PtyConfig {
    fn default() -> Self {
        Self {
            shell: std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string()),
            cols: 120,
            rows: 40,
            working_dir: None,
            env: Vec::new(),
        }
    }
}

/// Managed PTY instance
pub struct Pty {
    master: Box<dyn MasterPty + Send>,
    reader: Box<dyn Read + Send>,
    writer: Box<dyn Write + Send>,
    size: PtySize,
}

impl Pty {
    /// Create a new PTY with the given configuration
    pub fn new(config: PtyConfig) -> Result<Self, PtyError> {
        let pty_system = native_pty_system();

        let size = PtySize {
            rows: config.rows,
            cols: config.cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        let pair = pty_system
            .openpty(size)
            .map_err(|e| PtyError::CreateError(e.to_string()))?;

        // Build command for shell
        let mut cmd = CommandBuilder::new(&config.shell);

        // Set working directory if specified
        if let Some(dir) = &config.working_dir {
            cmd.cwd(dir);
        }

        // Add environment variables
        for (key, value) in &config.env {
            cmd.env(key, value);
        }

        // Set TERM environment variable for proper terminal emulation
        cmd.env("TERM", "xterm-256color");

        // Spawn the shell process
        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| PtyError::SpawnError(e.to_string()))?;

        // Get reader and writer from master
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| PtyError::CreateError(e.to_string()))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| PtyError::CreateError(e.to_string()))?;

        info!(
            "PTY created with shell: {}, size: {}x{}",
            config.shell, config.cols, config.rows
        );

        Ok(Self {
            master: pair.master,
            reader,
            writer,
            size,
        })
    }

    /// Write bytes to the PTY
    pub fn write(&mut self, data: &[u8]) -> Result<usize, PtyError> {
        let written = self.writer.write(data)?;
        self.writer.flush()?;
        debug!("Wrote {} bytes to PTY", written);
        Ok(written)
    }

    /// Read available bytes from the PTY (non-blocking-ish with timeout)
    pub fn read(&mut self, buf: &mut [u8]) -> Result<usize, PtyError> {
        match self.reader.read(buf) {
            Ok(n) => {
                debug!("Read {} bytes from PTY", n);
                Ok(n)
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => Ok(0),
            Err(e) => Err(PtyError::WriteError(e)),
        }
    }

    /// Try to read available output without blocking
    pub fn try_read(&mut self, buf: &mut [u8]) -> Result<usize, PtyError> {
        // Use the reader directly - it may or may not block depending on platform
        self.read(buf)
    }

    /// Resize the PTY
    pub fn resize(&mut self, cols: u16, rows: u16) -> Result<(), PtyError> {
        let new_size = PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        };

        self.master
            .resize(new_size)
            .map_err(|e| PtyError::ResizeError(e.to_string()))?;

        self.size = new_size;
        info!("PTY resized to {}x{}", cols, rows);
        Ok(())
    }

    /// Get current PTY size
    pub fn size(&self) -> (u16, u16) {
        (self.size.cols, self.size.rows)
    }

    /// Get the reader for async operations
    pub fn take_reader(&mut self) -> Box<dyn Read + Send> {
        std::mem::replace(&mut self.reader, Box::new(std::io::empty()))
    }
}
