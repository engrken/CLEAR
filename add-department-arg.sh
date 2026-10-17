
#!/usr/bin/env bash
# Run from the CLEAR System project root.
# Adds `, department` to one-argument requireTabAccess("tab-name") calls.
# Logs changed files and exact diffs, then runs TypeScript validation.

set -euo pipefail

# Ensure this is being run from the project root.
if [[ ! -d "app" || ! -d "lib" ]]; then
  echo "ERROR: Run this script from the project root."
  echo "The project root must contain both app/ and lib/."
  exit 1
fi

# Create a unique timestamped log in the project root.
LOG_FILE="requireTabAccess-patch-$(date +%Y%m%d-%H%M%S).log"

# Display output in the terminal and save it to the log.
exec > >(tee -a "$LOG_FILE") 2>&1

SEARCH_REGEX="requireTabAccess[[:space:]]*\\([[:space:]]*([\"'])tab-[a-z0-9-]+\\1[[:space:]]*\\)"

PATCHED_FILES=0
UNCHANGED_FILES=0
SKIPPED_FILES=0

echo "============================================================"
echo "CLEAR System - requireTabAccess Patch Log"
echo "Started: $(date)"
echo "Project root: $(pwd)"
echo "Log file: $LOG_FILE"
echo "============================================================"
echo

# Find source files containing matching one-argument calls.
mapfile -t FILES < <(
  grep -rlE \
    --include='*.ts' \
    --include='*.tsx' \
    --include='*.js' \
    --include='*.jsx' \
    "$SEARCH_REGEX" app lib 2>/dev/null || true
)

echo "Candidate files found: ${#FILES[@]}"
echo

for f in "${FILES[@]}"; do

  # Skip files that define their own requireTabAccess guard.
  if grep -qE \
    'function[[:space:]]+requireTabAccess|((const|let|var)[[:space:]]+requireTabAccess([[:space:]]*:[^=]+)?[[:space:]]*=)|requireTabAccess[[:space:]]*=[[:space:]]*(async[[:space:]]*)?\(' \
    "$f"; then

    echo "SKIPPED FILE: $f"
    echo "Reason: This file defines its own requireTabAccess guard."
    echo "Review this file manually if it still has one-argument calls."
    echo

    SKIPPED_FILES=$((SKIPPED_FILES + 1))
    continue
  fi

  # Preserve the original contents temporarily for an exact comparison.
  BEFORE_FILE="$(mktemp)"
  cp "$f" "$BEFORE_FILE"

  # Add department as the second argument.
  # Supports names such as tab-payment and tab-online-remittance.
  sed -i -E \
    "s/requireTabAccess\\(([[:space:]]*)([\"'])(tab-[a-z0-9-]+)\\2([[:space:]]*)\\)/requireTabAccess(\\1\\2\\3\\2, department\\4)/g" \
    "$f"

  # Report whether this file actually changed.
  if cmp -s "$BEFORE_FILE" "$f"; then

    echo "UNCHANGED FILE: $f"
    UNCHANGED_FILES=$((UNCHANGED_FILES + 1))

  else

    echo
    echo "CHANGED FILE: $f"
    echo "-------------------- EXACT DIFF --------------------"

    # Show the exact before-and-after changes in the log.
    diff -u \
      --label "$f (before)" \
      --label "$f (after)" \
      "$BEFORE_FILE" "$f" || true

    echo "----------------------------------------------------"
    echo

    PATCHED_FILES=$((PATCHED_FILES + 1))
  fi

  rm -f "$BEFORE_FILE"
done

# Display the patch summary.
echo
echo "===================== PATCH SUMMARY ====================="
echo "Candidate files: ${#FILES[@]}"
echo "Changed files:   $PATCHED_FILES"
echo "Unchanged files: $UNCHANGED_FILES"
echo "Skipped files:   $SKIPPED_FILES"
echo "========================================================="
echo

# Search again for matching one-argument calls.
echo "Remaining one-argument requireTabAccess calls:"

if grep -rnE \
  --include='*.ts' \
  --include='*.tsx' \
  --include='*.js' \
  --include='*.jsx' \
  "$SEARCH_REGEX" app lib; then

  echo
  echo "WARNING: Remaining calls need review."
  echo "Some may belong to skipped files or require manual editing."

else

  echo "None found by the search pattern."

fi

echo
echo "============================================================"
echo "TYPESCRIPT VALIDATION"
echo "============================================================"

# Automatically check the project for TypeScript errors.
if command -v npx >/dev/null 2>&1; then

  echo "Running: npx tsc --noEmit"
  echo

  if npx tsc --noEmit; then
    echo
    echo "RESULT: TypeScript validation PASSED."
  else
    TSC_STATUS=$?

    echo
    echo "RESULT: TypeScript validation FAILED."
    echo "Exit code: $TSC_STATUS"
    echo "The source modifications are still applied."
    echo "Review the errors above and the patch log: $LOG_FILE"

    exit "$TSC_STATUS"
  fi

else

  echo "TypeScript validation was skipped because npx was not found."
  echo "Run manually when Node.js/npm are available:"
  echo "npx tsc --noEmit"

fi

echo
echo "============================================================"
echo "PATCH PROCESS FINISHED"
echo "Finished: $(date)"
echo "Changed files: $PATCHED_FILES"
echo "Full log: $LOG_FILE"
echo "Review source changes with: git diff"
echo "============================================================"
