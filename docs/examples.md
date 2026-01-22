# Usage Examples

This guide provides practical examples of using Terminal MCP for various tasks.

## Basic Operations

### Running a Simple Command

```
1. type: {"text": "echo 'Hello, World!'"}
2. sendKey: {"key": "Enter"}
3. getContent: {}
```

**Expected Output:**
```
$ echo 'Hello, World!'
Hello, World!
$
```

### Running Multiple Commands

```
1. type: {"text": "pwd"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "ls -la"}
4. sendKey: {"key": "Enter"}
5. getContent: {}
```

### Using Command History

```
1. type: {"text": "echo first"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "echo second"}
4. sendKey: {"key": "Enter"}
5. sendKey: {"key": "ArrowUp"}  // Recalls "echo second"
6. sendKey: {"key": "ArrowUp"}  // Recalls "echo first"
7. sendKey: {"key": "Enter"}    // Executes "echo first"
```

## Interactive Programs

### Using a Text Editor (vim)

**Opening and editing a file:**
```
1. type: {"text": "vim test.txt"}
2. sendKey: {"key": "Enter"}
3. takeScreenshot: {}  // See vim interface
4. type: {"text": "i"}  // Enter insert mode
5. type: {"text": "Hello from vim!"}
6. sendKey: {"key": "Escape"}  // Exit insert mode
7. type: {"text": ":wq"}  // Save and quit
8. sendKey: {"key": "Enter"}
```

**Navigating in vim:**
```
// Arrow key navigation
sendKey: {"key": "ArrowUp"}
sendKey: {"key": "ArrowDown"}
sendKey: {"key": "ArrowLeft"}
sendKey: {"key": "ArrowRight"}

// vim-style navigation
type: {"text": "j"}  // Down
type: {"text": "k"}  // Up
type: {"text": "h"}  // Left
type: {"text": "l"}  // Right

// Page navigation
sendKey: {"key": "Ctrl+F"}  // Page down
sendKey: {"key": "Ctrl+B"}  // Page up
```

### Using nano

```
1. type: {"text": "nano myfile.txt"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "This is my content"}
4. sendKey: {"key": "Ctrl+O"}  // Write out
5. sendKey: {"key": "Enter"}   // Confirm filename
6. sendKey: {"key": "Ctrl+X"}  // Exit
```

### Using less (Pager)

```
1. type: {"text": "less /var/log/syslog"}
2. sendKey: {"key": "Enter"}
3. sendKey: {"key": "PageDown"}  // Scroll down
4. type: {"text": "/error"}      // Search for "error"
5. sendKey: {"key": "Enter"}
6. type: {"text": "n"}           // Next match
7. type: {"text": "q"}           // Quit
```

## TUI Applications

### Using htop

```
1. type: {"text": "htop"}
2. sendKey: {"key": "Enter"}
3. takeScreenshot: {}  // View process list
4. sendKey: {"key": "ArrowDown"}  // Select process
5. sendKey: {"key": "F9"}  // Kill menu
6. sendKey: {"key": "Enter"}  // Confirm kill signal
7. sendKey: {"key": "F10"}  // Quit htop
```

### Using lazygit

```
1. type: {"text": "lazygit"}
2. sendKey: {"key": "Enter"}
3. takeScreenshot: {}  // View git interface
4. type: {"text": "s"}  // Stage file
5. type: {"text": "c"}  // Commit
6. type: {"text": "Commit message"}
7. sendKey: {"key": "Enter"}
8. type: {"text": "q"}  // Quit
```

### Using Midnight Commander (mc)

```
1. type: {"text": "mc"}
2. sendKey: {"key": "Enter"}
3. sendKey: {"key": "Tab"}  // Switch panels
4. sendKey: {"key": "ArrowDown"}  // Navigate
5. sendKey: {"key": "Enter"}  // Enter directory
6. sendKey: {"key": "F10"}  // Exit
```

## REPL Sessions

### Python REPL

```
1. type: {"text": "python3"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "import math"}
4. sendKey: {"key": "Enter"}
5. type: {"text": "math.sqrt(144)"}
6. sendKey: {"key": "Enter"}
7. getContent: {}  // See: 12.0
8. sendKey: {"key": "Ctrl+D"}  // Exit Python
```

### Node.js REPL

```
1. type: {"text": "node"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "const arr = [1, 2, 3, 4, 5]"}
4. sendKey: {"key": "Enter"}
5. type: {"text": "arr.map(x => x * 2)"}
6. sendKey: {"key": "Enter"}
7. getContent: {}  // See: [ 2, 4, 6, 8, 10 ]
8. type: {"text": ".exit"}
9. sendKey: {"key": "Enter"}
```

### Ruby IRB

```
1. type: {"text": "irb"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "puts 'Hello Ruby!'"}
4. sendKey: {"key": "Enter"}
5. sendKey: {"key": "Ctrl+D"}  // Exit IRB
```

## Process Management

### Running a Background Process

```
1. type: {"text": "sleep 60 &"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "jobs"}
4. sendKey: {"key": "Enter"}
5. getContent: {}  // See background job
```

### Interrupting a Running Process

```
1. type: {"text": "ping google.com"}
2. sendKey: {"key": "Enter"}
3. // Wait a moment to see some output
4. getContent: {}  // See ping results
5. sendKey: {"key": "Ctrl+C"}  // Interrupt
6. getContent: {}  // See ping statistics
```

### Suspending and Resuming

```
1. type: {"text": "vim"}
2. sendKey: {"key": "Enter"}
3. sendKey: {"key": "Ctrl+Z"}  // Suspend vim
4. type: {"text": "ls"}
5. sendKey: {"key": "Enter"}
6. type: {"text": "fg"}  // Resume vim
7. sendKey: {"key": "Enter"}
```

## Tab Completion

### Basic Tab Completion

```
1. type: {"text": "cd /usr/lo"}
2. sendKey: {"key": "Tab"}  // Completes to /usr/local/
3. getContent: {}  // Verify completion
4. sendKey: {"key": "Enter"}
```

### Multiple Completions

```
1. type: {"text": "git co"}
2. sendKey: {"key": "Tab"}
3. sendKey: {"key": "Tab"}  // Show all options
4. getContent: {}  // See: commit, config, etc.
5. type: {"text": "mmit"}  // Complete to "commit"
```

## Working with Output

### Piping Commands

```
1. type: {"text": "cat /etc/passwd | grep root"}
2. sendKey: {"key": "Enter"}
3. getContent: {}
```

### Redirecting Output

```
1. type: {"text": "echo 'test' > output.txt"}
2. sendKey: {"key": "Enter"}
3. type: {"text": "cat output.txt"}
4. sendKey: {"key": "Enter"}
5. getContent: {}
```

### Watching Log Files

```
1. type: {"text": "tail -f /var/log/syslog"}
2. sendKey: {"key": "Enter"}
3. // Wait for new log entries
4. getContent: {"visibleOnly": true}  // Get current view
5. sendKey: {"key": "Ctrl+C"}  // Stop watching
```

## SSH Sessions

### Connecting via SSH

```
1. type: {"text": "ssh user@hostname"}
2. sendKey: {"key": "Enter"}
3. takeScreenshot: {}  // May see password prompt or key verification
4. type: {"text": "password"}  // If password auth
5. sendKey: {"key": "Enter"}
6. getContent: {}  // Now on remote host
```

### Running Remote Commands

```
1. type: {"text": "ssh user@host 'ls -la'"}
2. sendKey: {"key": "Enter"}
3. getContent: {}  // See remote directory listing
```

## Error Handling

### Handling Command Not Found

```
1. type: {"text": "nonexistent_command"}
2. sendKey: {"key": "Enter"}
3. getContent: {}  // See: command not found error
```

### Recovering from Stuck State

```
// If terminal appears stuck:
1. sendKey: {"key": "Ctrl+C"}  // Try interrupt
2. getContent: {}  // Check state
3. // If still stuck:
4. sendKey: {"key": "Ctrl+Z"}  // Try suspend
5. sendKey: {"key": "Ctrl+D"}  // Try EOF
```

## Best Practices

### Always Check Output

After running commands, use `getContent` or `takeScreenshot` to verify the result before proceeding.

### Use Appropriate Delays

For commands that produce output over time, you may need to wait before reading content:

```
1. type: {"text": "npm install"}
2. sendKey: {"key": "Enter"}
3. // Tool will return, but npm is still running
4. // Wait and poll getContent until complete
```

### Clear When Needed

If the terminal gets cluttered:

```
1. clear: {}
2. // Fresh terminal state
```

### Screenshot for TUI State

For TUI applications, `takeScreenshot` provides cursor position which helps understand where input will go.
