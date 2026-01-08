import "@typelex/emitter";
import "./richtext-facet.tsp";

namespace com.deckbelcher.richtext {
  /**
   * Rich text content with optional facet annotations.
   * Used for primers, descriptions, and other formatted text.
   */
  model Main {
    /** The text content. */
    @maxGraphemes(50000)
    @maxLength(500000)
    text?: string;

    /** Annotations of text (mentions, URLs, hashtags, card references, etc). */
    facets?: com.deckbelcher.richtext.facet.Main[];
  }
}
