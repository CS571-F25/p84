#!/usr/bin/env bash
# Add a card to test-cards.json fixture
# Usage: ./add-test-card.sh "Card Name"
#        ./add-test-card.sh --id "scryfall-uuid"

set -euo pipefail

if [[ $# -lt 1 ]]; then
	echo "Usage: $0 \"Card Name\"" >&2
	echo "       $0 --id \"scryfall-uuid\"" >&2
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURE="$SCRIPT_DIR/test-cards.json"

if [[ "$1" == "--id" ]]; then
	if [[ $# -lt 2 ]]; then
		echo "Usage: $0 --id \"scryfall-uuid\"" >&2
		exit 1
	fi
	SCRYFALL_ID="$2"
	# Fetch card by scryfall ID
	RESPONSE=$(curl -sf "https://api.scryfall.com/cards/$SCRYFALL_ID")
	CARD_NAME=$(echo "$RESPONSE" | jq -r '.name')
	ORACLE_ID=$(echo "$RESPONSE" | jq -r '.oracle_id')
else
	CARD_NAME="$1"
	# Fetch oracle_id from Scryfall by name
	ORACLE_ID=$(curl -sf "https://api.scryfall.com/cards/named?exact=$(printf '%s' "$CARD_NAME" | jq -sRr @uri)" | jq -r '.oracle_id')
fi

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
