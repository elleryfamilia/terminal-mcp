#!/bin/bash
set -e

# Terminal MCP Installer
# https://github.com/elleryfamilia/terminal-mcp

REPO_URL="https://github.com/elleryfamilia/terminal-mcp.git"
INSTALL_DIR="$HOME/.terminal-mcp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check for Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    fi

    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js 18+ is required. Current version: $(node -v)"
    fi

    info "Node.js $(node -v) detected"
}

# Check for git
check_git() {
    if ! command -v git &> /dev/null; then
        error "git is not installed. Please install git first."
    fi
}

# Determine bin directory
get_bin_dir() {
    if [ -d "$HOME/.local/bin" ]; then
        echo "$HOME/.local/bin"
    elif [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
        echo "/usr/local/bin"
    else
        mkdir -p "$HOME/.local/bin"
        echo "$HOME/.local/bin"
    fi
}

# Main installation
main() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║       Terminal MCP Installer           ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    check_git
    check_node

    # Clone or update repository
    if [ -d "$INSTALL_DIR" ]; then
        info "Updating existing installation..."
        cd "$INSTALL_DIR"
        git pull --ff-only
    else
        info "Cloning repository..."
        git clone "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi

    # Install dependencies and build
    info "Installing dependencies..."
    npm install

    info "Building..."
    npm run build

    # Create symlink
    BIN_DIR=$(get_bin_dir)
    SYMLINK_PATH="$BIN_DIR/terminal-mcp"

    if [ -L "$SYMLINK_PATH" ] || [ -f "$SYMLINK_PATH" ]; then
        rm "$SYMLINK_PATH"
    fi

    ln -s "$INSTALL_DIR/dist/index.js" "$SYMLINK_PATH"
    chmod +x "$INSTALL_DIR/dist/index.js"

    info "Created symlink at $SYMLINK_PATH"

    # Check if bin dir is in PATH
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        warn "$BIN_DIR is not in your PATH"
        echo ""
        echo "Add it to your shell profile:"
        echo "  echo 'export PATH=\"\$PATH:$BIN_DIR\"' >> ~/.bashrc"
        echo "  # or for zsh:"
        echo "  echo 'export PATH=\"\$PATH:$BIN_DIR\"' >> ~/.zshrc"
        echo ""
    fi

    echo ""
    echo -e "${GREEN}✓ Installation complete!${NC}"
    echo ""
    echo "Usage:"
    echo "  terminal-mcp              # Run the MCP server"
    echo "  terminal-mcp --help       # Show help"
    echo ""
    echo "MCP client configuration:"
    echo '  {'
    echo '    "mcpServers": {'
    echo '      "terminal": {'
    echo '        "command": "terminal-mcp"'
    echo '      }'
    echo '    }'
    echo '  }'
    echo ""
}

main
