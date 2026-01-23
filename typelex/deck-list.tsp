import "@typelex/emitter";
import "./externals.tsp";
import "./richtext.tsp";
import "./defs.tsp";

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

    /** Deck primer with strategy, combos, and card choices. */
    primer?: Primer;

    /** Array of cards in the decklist. */
    @required
    cards: Card[];

    /** Timestamp when the decklist was created. */
    @required
    createdAt: datetime;

    /** Timestamp when the decklist was last updated. */
    updatedAt?: datetime;
  }

  /** Primer content - inline, external URI, or linked record. */
  @inline
  union Primer {
    embedded: com.deckbelcher.richtext.Document,
    uri: PrimerUri,
    ref: PrimerRef,
    unknown,
  }

  /** External primer content. Typically a URL, but any valid URI scheme. */
  model PrimerUri {
    @required
    @format("uri")
    @maxLength(10000)
    @maxGraphemes(1000)
    uri: string;
  }

  /** Primer in a separate ATProto record. For use with any longform writing lexicon. */
  model PrimerRef {
    @required
    ref: com.atproto.repo.strongRef.Main;
  }

  /** A tag annotation for a card. */
  @maxGraphemes(64)
  @maxLength(640)
  scalar CardTag extends string;

  /** Which section of the deck this card belongs to. Extensible to support format-specific sections. */
  @maxGraphemes(64)
  @maxLength(640)
  union Section {
    "mainboard",
    "sideboard",
    "maybeboard",
    "commander",
    string,
  }

  /** A card entry in a decklist. */
  model Card {
    /** Reference to the card (scryfall printing + oracle card). */
    @required
    ref: com.deckbelcher.defs.CardRef;

    /** Number of copies in the deck. */
    @required
    @minValue(1)
    quantity: integer;

    /** Which section of the deck this card belongs to. Extensible to support format-specific sections. */
    @required
    section: Section;

    /** User annotations for this card in this deck (e.g., "removal", "wincon", "ramp"). */
    @maxItems(128)
    tags?: CardTag[];
  }
}
