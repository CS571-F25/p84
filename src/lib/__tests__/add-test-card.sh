#!/usr/bin/env bash
# Add a card to test-cards.json fixture
# Usage: ./add-test-card.sh "Card Name"

set -euo pipefail

if [[ $# -lt 1 ]]; then
	echo "Usage: $0 \"Card Name\"" >&2
	exit 1
fi

CARD_NAME="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE="$SCRIPT_DIR/test-cards.json"

# Fetch oracle_id from Scryfall
ORACLE_ID=$(curl -sf "https://api.scryfall.com/cards/named?exact=$(printf '%s' "$CARD_NAME" | jq -sRr @uri)" | jq -r '.oracle_id')

if [[ -z "$ORACLE_ID" || "$ORACLE_ID" == "null" ]]; then
	echo "Card not found: $CARD_NAME" >&2
	exit 1
fi

# Add to fixture and sort keys
jq -S --arg name "$CARD_NAME" --arg id "$ORACLE_ID" '. + {($name): $id}' "$FIXTURE" > "$FIXTURE.tmp"
mv "$FIXTURE.tmp" "$FIXTURE"

# Format with project settings (tabs)
npx biome format --write "$FIXTURE" >/dev/null 2>&1 || true

echo "Added: \"$CARD_NAME\": \"$ORACLE_ID\""
