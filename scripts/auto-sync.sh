#!/usr/bin/env bash
# 自动同步 CLI-SanGuoSha-online 上游更新并提交到本仓库。
# 用法：cron 定时调用，或手动执行。
# 流程：clone → npm install → build webui → sync-vendor.sh → git commit → cleanup
set -euo pipefail

REPO_DIR="/opt/polychat-plugin-sanguosha-repo"
UPSTREAM_URL="https://github.com/123456Zhe/Cli-SanGuoSha-online"
TMP_DIR="/tmp/cli-sanguosha-auto-sync-$$"
LOG_FILE="$REPO_DIR/logs/auto-sync.log"

mkdir -p "$REPO_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

log "=== 开始自动同步 ==="

# 1. Clone upstream
log "克隆上游仓库..."
git clone --depth 1 "$UPSTREAM_URL" "$TMP_DIR" 2>&1 | tail -3

# 2. Install deps & build
log "安装依赖..."
cd "$TMP_DIR" && npm install --silent 2>&1 | tail -2

log "构建 webui..."
cd "$TMP_DIR/webui" && npm install --silent 2>&1 | tail -1
npm run build 2>&1 | tail -3

# 3. Sync vendor
log "同步 vendor..."
GAME_REPO="$TMP_DIR" "$REPO_DIR/scripts/sync-vendor.sh" 2>&1 | tail -2

# 4. Check for changes
cd "$REPO_DIR"
if git diff --quiet && git diff --cached --quiet; then
    log "无变更，跳过提交"
    exit 0
fi

# 5. Commit
CHANGES=$(git diff --stat | head -1)
git add -A
git commit -m "auto-sync: $(date '+%Y-%m-%d %H:%M') — $CHANGES" 2>&1 | tail -2

log "=== 同步完成: $CHANGES ==="
