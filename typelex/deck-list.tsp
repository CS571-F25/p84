import "@typelex/emitter";
import "./externals.tsp";
import "./richtext.tsp";

namespace com.deckbelcher.deck.list {
  /** A Magic: The Gathering decklist. */
  @rec("tid")
  model Main {
    /** Name of the decklist. */
    @required
    @maxGraphemes(128)
    @maxLength(1280)
    name: string;

    /** Format of the deck (e.g., "commander", "cube", "pauper"). */
    @maxGraphemes(32)
    @maxLength(320)
    format?: string;

    /** Array of cards in the decklist. */
    @required
    cards: Card[];

    /** Deck primer with strategy, combos, and card choices. */
    primer?: com.deckbelcher.richtext.Main;

    /** Timestamp when the decklist was created. */
    @required
    createdAt: datetime;

    /** Timestamp when the decklist was last updated. */
    updatedAt?: datetime;
  }

  /** A tag annotation for a card. */
  @maxGraphemes(64)
  @maxLength(640)
  scalar CardTag extends string;

  /** A card entry in a decklist. */
  model Card {
    /** Scryfall UUID for the specific printing. */
    @required
    scryfallId: string;

    /** Number of copies in the deck. */
    @required
    @minValue(1)
    quantity: integer;

    /** Which section of the deck this card belongs to. Extensible to support format-specific sections. */
    @required
    section: "mainboard" | "sideboard" | "maybeboard" | "commander" | string;

    /** User annotations for this card in this deck (e.g., "removal", "wincon", "ramp"). */
    @maxItems(128)
    tags?: CardTag[];
  }
}
