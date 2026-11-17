#!/usr/bin/env bash
# 重放本地修复补丁：auto-sync 会从上游同步 vendor/ 与 webui/，
# 这里把 patch-files/ 中的本地修复文件覆盖回对应位置（上游未合入前持续生效）。
# 用法：在 auto-sync.sh 的 sync-vendor 之后调用。
#
# 当前状态（2026-11-17）：无本地补丁。两项旧补丁（ailog EACCES 崩溃兜底、
# turn-decision aiLoop.decide 异常兜底）已随上游合入，patch-files/ 已移除，
# 本脚本暂为占位。将来再有上游未合入的修复时，把补丁文件放回 patch-files/
# 对应路径，并在此处加回 cp 命令即可。
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PATCH_DIR="$REPO_DIR/patch-files"

if [ ! -d "$PATCH_DIR" ]; then
  echo "[patches] 无本地补丁，跳过"
  exit 0
fi

# 有 patch-files 目录时，把其中文件逐个覆盖回对应位置（相对路径与仓库内一致）
while IFS= read -r -d '' patch_file; do
  rel="${patch_file#$PATCH_DIR/}"
  cp -f "$patch_file" "$REPO_DIR/$rel"
  echo "[patches] 已应用：$rel"
done < <(find "$PATCH_DIR" -type f -print0)

echo "[patches] 完成"
