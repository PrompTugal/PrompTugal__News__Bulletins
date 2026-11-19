#!/usr/bin/env bash
# Run every gate, then rebase on dev and push. Stops at the first failure. Never pipe a gate.
set -euo pipefail
cd "$(dirname "$0")/.."
# Refuse during a hold (finding 3), with uncommitted changes (finding 4: the gates must check what is
# pushed), and check every commit's Agent: trailer before the push, while it can still be amended (finding 5).
[ -e board/HOLD.md ] && { echo "board/HOLD.md exists: no release while it does" >&2; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "uncommitted changes: commit or stash them first" >&2; exit 1; }
git fetch -q origin dev
node scripts/build.mjs
node scripts/validate.mjs
node scripts/test-leak-scan.mjs >/dev/null # the scan's key rules, each tested (security@, 05:14 UTC)
# Controls 7 and 8 (security@, 19 Nov 14:07 and 14:08): every security check runs from the last release's copy
# (origin/dev), never from the tree being pushed; a missing copy stops the release (set -e), with no fallback.
trap 'rm -f scripts/*.trusted.mjs' EXIT
trusted() { git show "origin/dev:scripts/$1.mjs" > "scripts/$1.trusted.mjs"; }
trusted leak-scan; trusted check-commits; trusted check-signatures
node scripts/leak-scan.trusted.mjs
node scripts/check-commits.trusted.mjs origin/dev HEAD
node scripts/test-check-signatures.mjs >/dev/null # the check's own tests first (conductor.b@, 19 Nov 02:16 UTC)
node scripts/check-signatures.trusted.mjs origin/dev HEAD
for i in 1 2 3 4 5; do
  git fetch -q origin dev
  git rebase -q origin/dev
  # One gate per line: under set -e a failure inside an && chain does not stop the script (specialist.code@ finding 1).
  node scripts/build.mjs >/dev/null
  node scripts/validate.mjs >/dev/null
  trusted leak-scan; trusted check-commits; trusted check-signatures
  node scripts/leak-scan.trusted.mjs >/dev/null
  node scripts/check-commits.trusted.mjs origin/dev HEAD >/dev/null
  node scripts/check-signatures.trusted.mjs origin/dev HEAD >/dev/null
  if git -c push.negotiate=true push -q origin HEAD:dev; then echo "released $(git rev-parse --short HEAD) to dev"; exit 0; fi
  sleep $((i * 3))
done
echo "release failed after 5 attempts" >&2; exit 1
