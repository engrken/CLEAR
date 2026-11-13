#!/usr/bin/env bash
set -euo pipefail
script="scripts/ci/check-impact.sh"
expect() {
  local expected="$1" job="$2"; shift 2
  local actual=0
  bash "$script" "$job" --paths "$@" >/dev/null || actual=$?
  if [[ "$actual" -ne "$expected" ]]; then
    echo "CI impact policy mismatch: job=$job paths=$* expected=$expected actual=$actual" >&2
    exit 1
  fi
}
for job in web mobile student-auth-security financial-security; do
  expect 10 "$job" docs/plan.md
  expect 10 "$job" README.md CHANGELOG.md
  expect 0 "$job" .circleci/config.yml
  expect 0 "$job" lib/auth.ts
  expect 0 "$job" unknown-file.xyz
done
expect 0 mobile mobile/app/index.tsx
expect 10 web mobile/app/index.tsx
expect 10 financial-security mobile/app/index.tsx
expect 10 student-auth-security mobile/app/index.tsx
expect 0 web mobile/app/index.tsx app/page.tsx
expect 10 mobile app/page.tsx
expect 0 web app/page.tsx
expect 0 student-auth-security app/page.tsx
expect 0 financial-security app/page.tsx
expect 0 mobile app/api/auth/route.ts
echo "CI impact policy tests passed."
