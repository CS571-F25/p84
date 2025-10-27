import "@typelex/emitter";
import "./externals.tsp";

namespace com.deckbelcher.social.like {
  /** Record declaring a 'like' of a piece of content (decklist, reply, etc). */
  @rec("tid")
  model Main {
    /** Reference to the content being liked. */
    @required
    subject: com.atproto.repo.strongRef.Main;

    /** Timestamp when the like was created. */
    @required
    createdAt: datetime;
  }
}
