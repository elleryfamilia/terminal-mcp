import * as pty from 'node-pty';

const child = pty.spawn('node', ['/Users/ellery/_git/terminal-mcp-gui/dist/mode-selector.js'], {
  name: 'xterm-256color',
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
  env: process.env,
});

let output = '';

child.onData((data) => {
  output += data;
  console.log('[PTY output]', data.length, 'bytes:', JSON.stringify(data.slice(0, 100)));
});

child.onExit(({ exitCode }) => {
  console.log('[PTY exit] code:', exitCode);
  console.log('[Full output]:', output);
});

// Send enter after a short delay to select default
setTimeout(() => {
  console.log('[Sending enter]');
  child.write('\r');
}, 500);
