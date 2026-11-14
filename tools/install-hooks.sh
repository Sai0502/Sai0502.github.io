#!/bin/sh
# 安装 pre-commit 钩子：提交时自动重跑 tools/update-search-paths.py，
# 让搜索清单和磁盘上的笔记在同一个提交里保持一致。
#
# 钩子放在 .git/hooks/，git 不跟踪它，所以每台机器（新克隆）要装一次：
#
#     sh tools/install-hooks.sh
#
# 装完以后的日常流程：写完 md → 在侧栏摆好位置 → 提交（GitHub 桌面版或命令行都一样）。

set -e

ROOT=$(git rev-parse --show-toplevel)
HOOK="$ROOT/.git/hooks/pre-commit"
MARKER="# >>> search-path-list >>>"

write_hook() {
  cat > "$HOOK" <<'HOOK_END'
#!/bin/sh
# >>> search-path-list >>>
# 由 tools/install-hooks.sh 安装，别手改；重新跑那个脚本即可覆盖。
# index.html 里 search.paths 是一份固定清单：静态站没法自己列出自己的 .md，
# 所以每加一篇笔记都要把页面重新写进清单，否则那篇搜不到，顺序也会错。
# 这里在提交前做掉，改动跟着这次提交一起走。

cd "$(git rev-parse --show-toplevel)" || exit 0
[ -f tools/update-search-paths.py ] || exit 0

if ! command -v python3 >/dev/null 2>&1; then
  echo "pre-commit: 找不到 python3，搜索清单没更新，提交已中止。" >&2
  echo "pre-commit: 装好 python3 后重试，或临时用 git commit --no-verify 跳过。" >&2
  exit 1
fi

if ! python3 tools/update-search-paths.py >/dev/null; then
  echo "pre-commit: tools/update-search-paths.py 执行失败，提交已中止。" >&2
  exit 1
fi

git add index.html
HOOK_END
  chmod +x "$HOOK"
}

if [ -f "$HOOK" ] && ! grep -q "$MARKER" "$HOOK" 2>/dev/null; then
  echo "已经有一个别的 pre-commit 钩子，没有覆盖：$HOOK" >&2
  echo "先把它备份走，再重跑本脚本。" >&2
  exit 1
fi

write_hook
echo "已安装：$HOOK"
echo "以后提交时自动更新 index.html 里的搜索清单。"
