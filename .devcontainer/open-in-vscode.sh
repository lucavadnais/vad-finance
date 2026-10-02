#!/bin/sh
# Opens a file in the VS Code window attached to this dev container, for the
# Vue DevTools inspector (see vite.config.ts), with `file [line column]`: the
# dev servers are started by docker compose, outside VS Code, so they cannot
# find its `code` command on their own.
file=$1
[ -n "$2" ] && file="$1:$2:${3:-1}"

code=$(ls -t "$HOME"/.vscode-server/bin/*/bin/remote-cli/code 2>/dev/null | head -n 1)
[ -n "$code" ] || { echo 'VS Code is not attached to this container' >&2; exit 1; }

# Each VS Code window leaves a socket; old ones stay behind: try the newest first
for socket in $(ls -t /tmp/vscode-ipc-*.sock 2>/dev/null); do
  VSCODE_IPC_HOOK_CLI=$socket "$code" --reuse-window --goto "$file" 2>/dev/null && exit 0
done
echo 'No open VS Code window found' >&2
exit 1
