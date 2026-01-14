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
    /** User's display name. */
    @maxGraphemes(64)
    @maxLength(640)
    displayName?: string;

    /** Free-form profile description. */
    @maxGraphemes(256)
    @maxLength(2560)
    description?: string;

    /** Annotations of text in the profile description (mentions, URLs, hashtags, etc). */
    descriptionFacets?: com.deckbelcher.richtext.facet.Main[];

    /** Free-form pronouns text. */
    @maxGraphemes(20)
    @maxLength(200)
    pronouns?: string;

    /** Timestamp when the profile was created. */
    @required
    createdAt: datetime;
  }
}
