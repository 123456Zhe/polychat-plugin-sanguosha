#!/usr/bin/env bash
# 重放本地修复补丁：auto-sync 会从上游同步 vendor/ 与 webui/，
# 这里把 patch-files/ 中的本地修复文件覆盖回对应位置（上游未合入前持续生效）。
# 用法：在 auto-sync.sh 的 sync-vendor 之后调用。
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_DIR="$REPO_DIR/patch-files"

[ -d "$PATCH_DIR" ] || { echo "patch-files 不存在，跳过"; exit 0; }

log() { echo "[patches] $*"; }

# vendor 修复（LLM 决策日志 EACCES 崩溃 / aiLoop.decide 异常兜底）
cp -f "$PATCH_DIR/vendor/devlog/ailog.js"        "$REPO_DIR/vendor/devlog/ailog.js"
cp -f "$PATCH_DIR/vendor/agent/turn-decision.js" "$REPO_DIR/vendor/agent/turn-decision.js"
log "vendor 补丁已应用：ailog.js, turn-decision.js"


log "完成"