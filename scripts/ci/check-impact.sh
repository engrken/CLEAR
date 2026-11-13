#!/usr/bin/env bash
# Conservative CircleCI job selection. Exit 0 = run, 10 = safely skip.
# Unknown paths, missing git history, and ambiguous diffs always RUN.
set -euo pipefail
job="${1:-}"
case "$job" in
  web|mobile|financial-security|student-auth-security) ;;
  *) echo "CI impact: unknown job '$job'; running by default"; exit 0 ;;
esac

if [[ "${2:-}" == "--paths" ]]; then
  # Deterministic local policy tests; CircleCI never supplies --paths.
  shift 2
  changed="$(printf '%s\n' "$@")"
else
  if [[ "${CIRCLE_BRANCH:-}" == "main" ]]; then
    if ! git rev-parse 'HEAD^' >/dev/null 2>&1; then
      echo 'CI impact: no parent commit; running all checks.'
      exit 0
    fi
    from='HEAD^'
  else
    if ! git fetch --no-tags --depth=100 origin main >/dev/null 2>&1; then
      echo 'CI impact: cannot fetch main; running all checks.'
      exit 0
    fi
    from="$(git merge-base origin/main HEAD 2>/dev/null || true)"
    if [[ -z "$from" ]]; then
      echo 'CI impact: missing merge base; running all checks.'
      exit 0
    fi
  fi
  if ! changed="$(git -c diff.renames=false diff --name-only "$from" HEAD)"; then
    echo 'CI impact: cannot read changes; running all checks.'
    exit 0
  fi
fi

if [[ -z "$changed" ]]; then
  echo 'CI impact: empty or unknown change set; running all checks.'
  exit 0
fi

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    README.md|CHANGELOG.md|docs/*|.github/ISSUE_TEMPLATE/*)
      # Repository documentation and issue templates cannot affect builds.
      continue ;;
    mobile/*)
      # Mobile-only modifications require the Expo gate, not three web builds.
      if [[ "$job" == "mobile" ]]; then
        echo "CI impact: $file requires $job"
        exit 0
      fi
      continue ;;
    app/api/*|lib/*|prisma/*|tests/*|scripts/*|package.json|package-lock.json|next.config.*|tsconfig.*|.circleci/*|.github/workflows/*)
      # Shared contracts, test code and CI changes run EVERY check.
      echo "CI impact: shared path $file requires $job"
      exit 0 ;;
    app/*|components/*|public/*|styles/*)
      # UI-only changes cannot change mobile app code, but require web/security.
      if [[ "$job" != "mobile" ]]; then
        echo "CI impact: $file requires $job"
        exit 0
      fi
      continue ;;
    *)
      # Unknown paths must not suppress tests.
      echo "CI impact: unclassified path $file requires $job"
      exit 0 ;;
  esac
done <<< "$changed"
echo "CI impact: $job safely skipped (documentation, mobile-only or web-UI-only changes)."
exit 10
