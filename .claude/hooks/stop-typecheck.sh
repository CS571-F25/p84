#!/usr/bin/env bash
set -e

input=$(cat)
if [ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]; then
    exit 0
fi

output=$(npm run typecheck:faster 2>&1) && exit 0

# Extract just the error lines (skip npm boilerplate)
errors=$(echo "$output" | grep -E "error TS[0-9]+:" | head -15)

# Escape for JSON
escaped=$(echo "$errors" | jq -Rs .)
# Remove surrounding quotes that jq adds
escaped=${escaped:1:-1}

cat <<EOF
{
    "decision": "block",
    "reason": "${escaped}\n\n[Stop Hook] Typecheck failed. If errors are from your changes, fix them. If unrelated (might be caused by another instance of Claude Code), mention them and stop. If you already asked the user a question that determines how to fix this, wait for their answer."
}
EOF
exit 2
