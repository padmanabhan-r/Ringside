#!/usr/bin/env bash
# Checks the repo before any product code exists: every relative Markdown link resolves,
# and no key-shaped string is committed. Runs locally and in CI with no keys.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
status=0

# 1. Relative links in tracked Markdown files resolve (URLs, pure anchors and gitignored targets are skipped).
while IFS= read -r md; do
  dir=$(dirname "$md")
  while IFS= read -r target; do
    path=${target%%#*}
    [ -z "$path" ] && continue
    git check-ignore -q "$dir/$path" && continue   # local-only targets (docs/) are absent in CI
    if [ ! -e "$dir/$path" ]; then
      echo "broken link: $md -> $target"
      status=1
    fi
  done < <(grep -oE '\]\([^)]+\)' "$md" | sed -E 's/^\]\((.*)\)$/\1/' | grep -vE '^(https?:|mailto:|#)' || true)
done < <(git ls-files '*.md')

# 2. No secrets in tracked files. This script holds the patterns, and the lockfile's integrity hashes look key-shaped, so both are excluded.
patterns='(sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|whsec_[A-Za-z0-9]{10,}|Bearer [A-Za-z0-9._-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b[AE][A-Za-z0-9_-]{78,}\b)'
if git grep -nE "$patterns" -- . ':!scripts/check-docs.sh' ':!package-lock.json'; then
  echo "key-shaped string found (above)"
  status=1
fi

# 3. No env file other than the example is tracked.
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example$'; then
  echo "env file tracked (above)"
  status=1
fi

[ "$status" -eq 0 ] && echo "docs and secrets check passed"
exit "$status"
