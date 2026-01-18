import "@typelex/emitter";
import "./externals.tsp";
import "./defs.tsp";
import "./richtext-facet.tsp";
import "./richtext.tsp";
import "./deck-list.tsp";
import "./collection-list.tsp";
import "./social-like.tsp";

namespace com.deckbelcher.actor.profile {
  /** A DeckBelcher user profile. */
  @rec("literal:self")
  model Main {
    /** Profile bio/description as a rich text document. */
    bio?: com.deckbelcher.richtext.Document;

    /** Free-form pronouns text. */
    @maxGraphemes(20)
    @maxLength(200)
    pronouns?: string;

    /** Timestamp when the profile was created. */
    @required
    createdAt: datetime;
  }
}
