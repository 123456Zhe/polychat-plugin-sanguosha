#!/usr/bin/env bash
# 自动同步 CLI-SanGuoSha-online 上游更新并提交到本仓库。
# 用法：cron 定时调用，或手动执行。
# 流程：clone → npm install → build webui → sync-vendor.sh → git commit → push → cleanup
set -uo pipefail

REPO_DIR="/opt/polychat-plugin-sanguosha-repo"
UPSTREAM_URL="https://github.com/123456Zhe/Cli-SanGuoSha-online"
TMP_DIR="/tmp/cli-sanguosha-auto-sync-$$"
LOG_FILE="$REPO_DIR/logs/auto-sync.log"

mkdir -p "$REPO_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

log "=== 开始自动同步 ==="

# 1. Clone upstream（直接输出不截断，保证 exit code 传递）
log "克隆上游仓库..."
git clone --depth 1 "$UPSTREAM_URL" "$TMP_DIR" >> "$LOG_FILE" 2>&1 || {
    log "❌ clone 失败，跳过本次同步"; exit 1
}

# 2. 主仓库依赖
log "安装主仓库依赖..."
(cd "$TMP_DIR" && npm install --prefer-offline >> "$LOG_FILE" 2>&1) || {
    log "❌ npm install 失败，跳过本次同步"; exit 1
}

# 3. webui 依赖 + 构建（rollup 原生包是 optional dep，不能加 --no-optional）
log "安装 webui 依赖..."
(cd "$TMP_DIR/webui" && npm install --prefer-offline >> "$LOG_FILE" 2>&1) || {
    log "❌ webui npm install 失败，跳过本次同步"; exit 1
}

log "构建 webui..."
(cd "$TMP_DIR/webui" && npm run build >> "$LOG_FILE" 2>&1) || {
    log "❌ webui build 失败，跳过本次同步"; exit 1
}

# 4. Sync vendor
log "同步 vendor..."
(GAME_REPO="$TMP_DIR" "$REPO_DIR/scripts/sync-vendor.sh" >> "$LOG_FILE" 2>&1) || {
    log "❌ sync-vendor 失败，跳过本次同步"; exit 1
}

# 5. Check for changes
cd "$REPO_DIR"
if git diff --quiet && git diff --cached --quiet; then
    log "无变更，跳过提交"
    exit 0
fi

# 6. Commit
CHANGES=$(git diff --stat | head -1)
git add -A
git commit -m "auto-sync: $(date '+%Y-%m-%d %H:%M') — $CHANGES" >> "$LOG_FILE" 2>&1 || {
    log "❌ commit 失败"; exit 1
}
log "✅ 已提交: $CHANGES"

# 7. Push to remotes
log "推送到远程仓库..."
git push origin main >> "$LOG_FILE" 2>&1 \
    && log "✅ Gitea push 成功" || log "⚠️  Gitea push 失败"
git push github main >> "$LOG_FILE" 2>&1 \
    && log "✅ GitHub push 成功" || log "⚠️  GitHub push 失败"

log "=== 同步完成 ==="
