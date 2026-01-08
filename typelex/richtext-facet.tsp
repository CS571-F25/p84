import "@typelex/emitter";
import "./externals.tsp";

namespace com.deckbelcher.richtext.facet {
  /**
   * Annotation of a sub-string within rich text.
   * Extends Bluesky's facet system to support DeckBelcher-specific features.
   */
  model Main {
    @required
    index: ByteSlice;

    @required
    features: (Mention | Link | Tag | Bold | Italic | unknown)[];
  }

  /**
   * Specifies the sub-string range a facet feature applies to.
   * Start index is inclusive, end index is exclusive.
   * Indices are zero-indexed, counting bytes of the UTF-8 encoded text.
   */
  model ByteSlice {
    @required
    @minValue(0)
    byteStart: integer;

    @required
    @minValue(0)
    byteEnd: integer;
  }

  /**
   * Facet feature for mention of another account.
   * The text is usually a handle, including an `@` prefix, but the facet reference is a DID.
   */
  model Mention {
    @required
    did: did;
  }

  /**
   * Facet feature for a URL.
   * The text URL may have been simplified or truncated, but the facet reference should be a complete URL.
   */
  model Link {
    @required
    uri: uri;
  }

  /**
   * Facet feature for a hashtag.
   * The text usually includes a '#' prefix, but the facet reference should not.
   */
  model Tag {
    @required
    @maxGraphemes(64)
    @maxLength(640)
    tag: string;
  }

  /**
   * Facet feature for bold text formatting.
   * Typically rendered as `<strong>` in HTML.
   */
  model Bold {}

  /**
   * Facet feature for italic text formatting.
   * Typically rendered as `<em>` in HTML.
   */
  model Italic {}
}
