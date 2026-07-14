#!/bin/bash
# PostToolUse hook: docs/ 配下の md/mdx が編集されたら
#   1. frontmatter の必須フィールド (title / description) を検証
#   2. markdownlint-cli2 を実行
# 問題があれば exit 2 で Claude にフィードバックする(stderr がモデルに渡る)

set -u

INPUT=$(cat)

# stdin の JSON から tool_input.file_path を抽出(jq 非依存)
FILE_PATH=$(printf '%s' "$INPUT" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get("tool_input", {}).get("file_path", ""))
except Exception:
    pass
')

# 対象外(docs/ 配下の md/mdx 以外)は何もしない
[ -z "$FILE_PATH" ] && exit 0
case "$FILE_PATH" in
  */docs/*.md|*/docs/*.mdx|docs/*.md|docs/*.mdx) ;;
  *) exit 0 ;;
esac
[ -f "$FILE_PATH" ] || exit 0

ERRORS=""

# --- 1. frontmatter 検証 ---
FM_RESULT=$(python3 - "$FILE_PATH" <<'PYEOF'
import re, sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

m = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
if not m:
    print("frontmatter がありません(--- で囲んだ title / description が必要です)")
    sys.exit(0)

fm = m.group(1)
missing = []
for field in ("title", "description"):
    if not re.search(rf"^{field}\s*:\s*\S", fm, re.MULTILINE):
        missing.append(field)
if missing:
    print(f"frontmatter に必須フィールドがありません: {', '.join(missing)}")

# Blume の frontmatter スキーマは strict のため、独自フィールドはビルドから除外される
allowed = {
    "authors", "changelog", "date", "deprecated", "description", "draft",
    "hidden", "icon", "lastModified", "noindex", "search", "seo",
    "sidebar", "slug", "title", "type",
}
keys = re.findall(r"^([A-Za-z_][\w-]*)\s*:", fm, re.MULTILINE)
unknown = [k for k in keys if k not in allowed]
if unknown:
    print(
        f"frontmatter に Blume 非対応のフィールドがあります: {', '.join(unknown)}"
        "(このページはビルドから除外されます。ステータス管理は本文冒頭の"
        "「> ステータス: **draft**」行を使ってください)"
    )
PYEOF
)
[ -n "$FM_RESULT" ] && ERRORS="$FM_RESULT"

# --- 2. markdownlint ---
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ -x "$PROJECT_DIR/node_modules/.bin/markdownlint-cli2" ]; then
  LINT_OUTPUT=$(cd "$PROJECT_DIR" && ./node_modules/.bin/markdownlint-cli2 "$FILE_PATH" 2>&1)
  if [ $? -ne 0 ]; then
    LINT_ERRORS=$(printf '%s' "$LINT_OUTPUT" | grep -E '^[^ ]+:[0-9]+' || true)
    [ -n "$LINT_ERRORS" ] && ERRORS="${ERRORS:+$ERRORS
}markdownlint エラー:
$LINT_ERRORS"
  fi
fi

if [ -n "$ERRORS" ]; then
  echo "[check-docs] $FILE_PATH に問題があります。修正してください:" >&2
  echo "$ERRORS" >&2
  exit 2
fi

exit 0
