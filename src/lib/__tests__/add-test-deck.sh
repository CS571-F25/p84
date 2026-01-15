#!/usr/bin/env bash
# Add a deck to test fixtures by fetching from ATProto
# Usage: ./add-test-deck.sh "deck-name" "at://did:plc:xxx/com.deckbelcher.deck.list/rkey"
#
# Fetches the deck record from Slingshot and saves it locally for tests.

set -euo pipefail

if [[ $# -lt 2 ]]; then
	echo "Usage: $0 <deck-name> <at-uri>" >&2
	echo "Example: $0 hamza-pdh at://did:plc:xxx/com.deckbelcher.deck.list/3m7..." >&2
	exit 1
fi

DECK_NAME="$1"
AT_URI="$2"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DECKS_DIR="$SCRIPT_DIR/test-decks"
INDEX_FILE="$SCRIPT_DIR/test-decks.json"

# Parse AT URI: at://did/collection/rkey
if [[ ! "$AT_URI" =~ ^at://([^/]+)/([^/]+)/([^/]+)$ ]]; then
	echo "Invalid AT URI format: $AT_URI" >&2
	echo "Expected: at://did/collection/rkey" >&2
	exit 1
fi

DID="${BASH_REMATCH[1]}"
COLLECTION="${BASH_REMATCH[2]}"
RKEY="${BASH_REMATCH[3]}"

# Fetch from Slingshot
SLINGSHOT_URL="https://slingshot.microcosm.blue/xrpc/com.atproto.repo.getRecord"
FULL_URL="${SLINGSHOT_URL}?repo=${DID}&collection=${COLLECTION}&rkey=${RKEY}"

echo "Fetching: $FULL_URL"

RESPONSE=$(curl -sf "$FULL_URL")

if [[ -z "$RESPONSE" ]]; then
	echo "Failed to fetch deck record" >&2
	exit 1
fi

# Check for error response
if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
	ERROR=$(echo "$RESPONSE" | jq -r '.message // .error')
	echo "Error from Slingshot: $ERROR" >&2
	exit 1
fi

# Extract just the value (the actual deck record)
DECK_VALUE=$(echo "$RESPONSE" | jq '.value')

if [[ -z "$DECK_VALUE" || "$DECK_VALUE" == "null" ]]; then
	echo "No value in response" >&2
	exit 1
fi

# Create decks directory if needed
mkdir -p "$DECKS_DIR"

# Save deck record
DECK_FILE="$DECKS_DIR/${DECK_NAME}.json"
echo "$DECK_VALUE" | jq '.' > "$DECK_FILE"
echo "Saved deck to: $DECK_FILE"

# Update or create index file
if [[ ! -f "$INDEX_FILE" ]]; then
	echo '{"$comment": "Maps deck names to AT URIs for test fixtures. Add decks with add-test-deck.sh"}' > "$INDEX_FILE"
fi

# Add to index
jq -S --arg name "$DECK_NAME" --arg uri "$AT_URI" '. + {($name): $uri}' "$INDEX_FILE" > "$INDEX_FILE.tmp"
mv "$INDEX_FILE.tmp" "$INDEX_FILE"

# Format files
npx biome format --write "$DECK_FILE" "$INDEX_FILE" >/dev/null 2>&1 || true

# Show deck info
DECK_DISPLAY_NAME=$(echo "$DECK_VALUE" | jq -r '.name // "unnamed"')
FORMAT=$(echo "$DECK_VALUE" | jq -r '.format // "unknown"')
CARD_COUNT=$(echo "$DECK_VALUE" | jq '[.cards[].quantity] | add')

echo ""
echo "Added deck fixture:"
echo "  Name: $DECK_DISPLAY_NAME"
echo "  Format: $FORMAT"
echo "  Cards: $CARD_COUNT"
echo "  Key: $DECK_NAME"
