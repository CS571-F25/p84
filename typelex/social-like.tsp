import "@typelex/emitter";
import "./externals.tsp";
import "./defs.tsp";

namespace com.deckbelcher.social.like {
  /** Record declaring a 'like' of a piece of content (card, deck, reply, etc). */
  @rec("tid")
  model Main {
    /** Reference to the content being liked. */
    @required
    subject: CardSubject | RecordSubject | unknown;

    /** Timestamp when the like was created. */
    @required
    createdAt: datetime;
  }

  /** Subject for liking a card. */
  model CardSubject {
    /** Reference to the card. */
    @required
    ref: com.deckbelcher.defs.CardRef;
  }

  /** Subject for liking an ATProto record (deck, reply, etc). */
  model RecordSubject {
    /** Reference to the record. */
    @required
    ref: com.atproto.repo.strongRef.Main;
  }
}
