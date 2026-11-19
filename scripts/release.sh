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
# BEFORE is origin/dev (already checked); refuse unless it is an ancestor of what is pushed (no force push).
trusted() { git merge-base --is-ancestor origin/dev HEAD || { echo "origin/dev is not an ancestor of HEAD" >&2; exit 1; }; git show "origin/dev:scripts/$1.mjs" > "scripts/$1.trusted.mjs"; }
# Config from the base too (signals.b@'s finding): the trailer check reads origin/dev's exemptions, not the pushed ones.
trailers() {
  local keep; keep=$(mktemp); [ -e scripts/commit-exemptions.json ] && cp scripts/commit-exemptions.json "$keep" || : > "$keep"
  rm -f scripts/commit-exemptions.json
  if git cat-file -e origin/dev:scripts/commit-exemptions.json 2>/dev/null; then git show origin/dev:scripts/commit-exemptions.json > scripts/commit-exemptions.json; fi
  local rc=0; node scripts/check-commits.trusted.mjs origin/dev HEAD || rc=$?
  if [ -s "$keep" ]; then cp "$keep" scripts/commit-exemptions.json; elif ! git cat-file -e HEAD:scripts/commit-exemptions.json 2>/dev/null; then rm -f scripts/commit-exemptions.json; fi
  rm -f "$keep"; return $rc
}
trusted leak-scan; trusted check-commits; trusted check-signatures
node scripts/leak-scan.trusted.mjs
trailers
node scripts/test-check-signatures.mjs >/dev/null # the check's own tests first (conductor.b@, 19 Nov 02:16 UTC)
node scripts/check-signatures.trusted.mjs origin/dev HEAD
# Control 10 (no symlinks): its tests, then origin/dev's copy of the check (HEAD's only while origin/dev has none).
node scripts/test-check-symlinks.mjs >/dev/null
symlinks() {
  if git cat-file -e origin/dev:scripts/check-symlinks.mjs 2>/dev/null; then git show origin/dev:scripts/check-symlinks.mjs > scripts/check-symlinks.trusted.mjs; else test "$(git hash-object scripts/check-symlinks.mjs)" = 5001415bc3284f9f49fbdd07a954fbc8b07e2e49 || { echo "control 10: no checker on origin/dev and HEAD's is not the reviewed one" >&2; return 1; }; cp scripts/check-symlinks.mjs scripts/check-symlinks.trusted.mjs; fi
  local ex=(); if git cat-file -e origin/dev:scripts/symlink-exceptions.json 2>/dev/null; then git show origin/dev:scripts/symlink-exceptions.json > "$(git rev-parse --git-dir)/symlink-exceptions.json"; ex=(--exceptions "$(git rev-parse --git-dir)/symlink-exceptions.json"); fi
  node scripts/check-symlinks.trusted.mjs "$(git rev-parse origin/dev)" "$(git rev-parse HEAD)" ${ex[@]+"${ex[@]}"} --site src
}
symlinks
for i in 1 2 3 4 5; do
  git fetch -q origin dev
  git rebase -q origin/dev
  # One gate per line: under set -e a failure inside an && chain does not stop the script (specialist.code@ finding 1).
  node scripts/build.mjs >/dev/null
  node scripts/validate.mjs >/dev/null
  trusted leak-scan; trusted check-commits; trusted check-signatures
  node scripts/leak-scan.trusted.mjs >/dev/null
  trailers >/dev/null
  node scripts/check-signatures.trusted.mjs origin/dev HEAD >/dev/null
  symlinks >/dev/null
  if git -c push.negotiate=true push -q origin HEAD:dev; then echo "released $(git rev-parse --short HEAD) to dev"; exit 0; fi
  sleep $((i * 3))
done
echo "release failed after 5 attempts" >&2; exit 1
