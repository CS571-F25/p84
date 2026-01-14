import "@typelex/emitter";
import "./externals.tsp";
import "./richtext.tsp";
import "./defs.tsp";

namespace com.deckbelcher.collection.list {
  /** A curated list of cards and/or decks. */
  @rec("tid")
  model Main {
    /** Name of the list. */
    @required
    @maxGraphemes(128)
    @maxLength(1280)
    name: string;

    /** Description of the list. */
    description?: com.deckbelcher.richtext.Document;

    /** Items in the list. */
    @required
    items: (CardItem | DeckItem | unknown)[];

    /** Timestamp when the list was created. */
    @required
    createdAt: datetime;

    /** Timestamp when the list was last updated. */
    updatedAt?: datetime;
  }

  /** A card saved to the list. */
  model CardItem {
    /** Reference to the card (scryfall printing + oracle card). */
    @required
    ref: com.deckbelcher.defs.CardRef;

    /** Timestamp when this item was added to the list. */
    @required
    addedAt: datetime;
  }

  /** A deck saved to the list. */
  model DeckItem {
    /** AT-URI of the deck record. */
    @required
    deckUri: atUri;

    /** Timestamp when this item was added to the list. */
    @required
    addedAt: datetime;
  }
}
