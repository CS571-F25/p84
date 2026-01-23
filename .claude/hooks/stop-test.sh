#!/usr/bin/env bash
set -e

input=$(cat)
if [ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]; then
    exit 0
fi

output=$(npm run test -- --changed 2>&1) && exit 0

# Get the failure summary (last 30 lines usually has the good stuff)
errors=$(echo "$output" | tail -30)

# Escape for JSON
escaped=$(echo "$errors" | jq -Rs .)
# Remove surrounding quotes that jq adds
escaped=${escaped:1:-1}

cat <<EOF
{
    "decision": "block",
    "reason": "${escaped}\n\n[Stop Hook] Tests failed. If failures are from your changes, fix them. If unrelated (might be caused by another instance of Claude Code), mention them and stop. If you already asked the user a question that determines how to fix this, wait for their answer."
}
EOF
exit 2
