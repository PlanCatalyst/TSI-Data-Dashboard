#!/usr/bin/env sh
# Design-system guardrail (docs/requirements-v2.md, AC7.1 and AC7.2).
# Fails when a colour literal appears outside tokens.css or when a radius is
# anything other than 0 or 50%. Run: npm run lint:tokens
set -eu
cd "$(dirname "$0")/.."
fail=0

if grep -rnE '#[0-9a-fA-F]{3,8}\b' src --include='*.css' --include='*.ts' --include='*.tsx' --exclude=tokens.css; then
  echo "lint:tokens: hex literal outside src/styles/tokens.css (AC7.1)" >&2
  fail=1
fi

if grep -rnE 'border-radius:|borderRadius:' src --include='*.css' --include='*.tsx' --exclude=tokens.css \
  | grep -vE 'var\(--radius|50%|radius: 0\b'; then
  echo "lint:tokens: radius must be var(--radius), 0 or 50% (AC7.2)" >&2
  fail=1
fi

exit "$fail"
