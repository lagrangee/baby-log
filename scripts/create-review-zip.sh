#!/usr/bin/env bash
set -euo pipefail

stamp="${1:-$(date +%Y%m%d-%H%M%S)}"
out="review/baby-log-source-review-${stamp}.zip"

mkdir -p review
paths=(
  AGENTS.md
  README.md
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  wrangler.toml
  worker-configuration.d.ts
  index.html
  public
  src
  tests
  docs
  migrations
  scripts
)

zip -r "$out" \
  "${paths[@]}" \
  -x '*/.DS_Store' '.DS_Store' 'docs/planning/*'

printf '%s\n' "$out"
