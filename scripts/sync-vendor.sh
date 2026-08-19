#!/usr/bin/env bash
# 从 CLI-SanGuoSha 仓库重建 vendor 快照（编译产物 + rules.md + webui）。
# 用法：GAME_REPO=/path/to/CLI-SanGuoSha ./scripts/sync-vendor.sh
set -euo pipefail

GAME_REPO="${GAME_REPO:-${1:-}}"
if [[ -z "$GAME_REPO" || ! -d "$GAME_REPO" ]]; then
  echo "用法: GAME_REPO=/path/to/CLI-SanGuoSha $0" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$GAME_REPO/dist"

(cd "$GAME_REPO" && npm run build)

mkdir -p "$ROOT"/vendor/{engine,agent,network,devlog} "$ROOT"/webui
for f in game cards interaction types resolve skills skill-hooks generals card-utils ai-heuristics; do
  cp "$DIST/engine/$f.js" "$ROOT/vendor/engine/"
done
for f in ai prompt local-engine round-context turn-decision ollama qwen strategy-memory; do
  cp "$DIST/agent/$f.js" "$ROOT/vendor/agent/"
done
for f in server protocol line-parser; do
  cp "$DIST/network/$f.js" "$ROOT/vendor/network/"
done
cp "$DIST/devlog/ailog.js" "$ROOT/vendor/devlog/"
cp "$GAME_REPO/rules.md" "$ROOT/rules.md"
# 新版 webui 是 Vue 3 + Vite 产物，输出在 webui/dist/（index.html + assets/）
rm -rf "$ROOT/webui" && mkdir -p "$ROOT/webui/assets"
cp "$GAME_REPO/webui/dist/index.html" "$ROOT/webui/"
cp "$GAME_REPO/webui/dist/assets/"* "$ROOT/webui/assets/"

echo "vendor 快照已更新（engine/agent/network/devlog + rules.md + webui）"
