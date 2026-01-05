#!/usr/bin/env bash
# Query Scryfall API for card data
#
# Usage:
#   ./scripts/scryfall.sh "ancestral recall"
#   ./scripts/scryfall.sh -f set_type "sol ring"
#   ./scripts/scryfall.sh -q "layout:token treasure"

set -euo pipefail

FIELD=""
RAW_QUERY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--field)
            FIELD="$2"
            shift 2
            ;;
        -q|--query)
            RAW_QUERY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options] <query>"
            echo ""
            echo "Options:"
            echo "  -f, --field <name>  Show specific field (e.g., set_type, layout, legalities)"
            echo "  -q, --query         Pass query directly to Scryfall (don't wrap in name search)"
            echo "  -h, --help          Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 \"ancestral recall\"           # Search by name"
            echo "  $0 -f set_type \"sol ring\"       # Show set_type for each printing"
            echo "  $0 -q \"layout:token treasure\"   # Raw Scryfall query"
            exit 0
            ;;
        *)
            QUERY="$1"
            shift
            ;;
    esac
done

if [[ -z "${QUERY:-}" ]]; then
    echo "Error: No query provided" >&2
    exit 1
fi

# Build the search query
if [[ "$RAW_QUERY" == true ]]; then
    SEARCH_QUERY="$QUERY"
else
    SEARCH_QUERY="!\"$QUERY\""
fi

# URL encode the query
ENCODED=$(printf '%s' "$SEARCH_QUERY" | jq -sRr @uri)

# Fetch from Scryfall
URL="https://api.scryfall.com/cards/search?q=${ENCODED}&unique=prints&order=released"

echo "Query: $SEARCH_QUERY" >&2
echo "URL: $URL" >&2
echo "" >&2

RESPONSE=$(curl -s "$URL")

# Check for errors
if echo "$RESPONSE" | jq -e '.object == "error"' > /dev/null 2>&1; then
    echo "$RESPONSE" | jq -r '.details'
    exit 1
fi

# Extract and display results
if [[ -n "$FIELD" ]]; then
    echo "$RESPONSE" | jq -r ".data[] | [.set, .name, .$FIELD] | @tsv" | while IFS=$'\t' read -r set name val; do
        printf "%-6s %-30s → %s: %s\n" "$set" "$name" "$FIELD" "$val"
    done
else
    echo "$RESPONSE" | jq -r '.data[] | [.set, .set_type, .layout, .name] | @tsv' | while IFS=$'\t' read -r set set_type layout name; do
        printf "%-6s set_type: %-12s layout: %-15s %s\n" "$set" "$set_type" "$layout" "$name"
    done
fi

# Show count
COUNT=$(echo "$RESPONSE" | jq '.data | length')
TOTAL=$(echo "$RESPONSE" | jq '.total_cards')
echo "" >&2
echo "Showing $COUNT of $TOTAL results" >&2
