import "@typelex/emitter";
import "./richtext-facet.tsp";

namespace com.deckbelcher.richtext {
  /**
   * A single paragraph of rich text with optional facet annotations.
   * Used for descriptions and other short formatted text.
   */
  model Main {
    /** The plain text content (no markdown symbols). */
    @maxGraphemes(50000)
    @maxLength(500000)
    text?: string;

    /** Annotations of text (mentions, URLs, hashtags, formatting, etc). */
    facets?: com.deckbelcher.richtext.facet.Main[];
  }

  /**
   * A multi-block rich text document.
   * Used for primers and other long-form content.
   */
  model Document {
    /** Array of blocks (paragraphs, headings, etc). */
    @required
    content: (
      | ParagraphBlock
      | HeadingBlock
      | CodeBlock
      | BulletListBlock
      | OrderedListBlock
      | HorizontalRuleBlock
      | unknown
    )[];
  }

  /** A paragraph block with text and optional facets. */
  model ParagraphBlock {
    /** The plain text content (no markdown symbols). */
    @maxGraphemes(50000)
    @maxLength(500000)
    text?: string;

    /** Annotations of text (formatting, mentions, links, etc). */
    facets?: com.deckbelcher.richtext.facet.Main[];
  }

  /** A heading block with level, text, and optional facets. */
  model HeadingBlock {
    /** Heading level (1-6). */
    @required
    @minValue(1)
    @maxValue(6)
    level: integer;

    /** The plain text content (no markdown symbols). */
    @maxGraphemes(1000)
    @maxLength(10000)
    text?: string;

    /** Annotations of text (formatting, mentions, links, etc). */
    facets?: com.deckbelcher.richtext.facet.Main[];
  }

  /** A code block with optional language hint. */
  model CodeBlock {
    /** The code content (plain text, no facets). */
    @required
    @maxLength(100000)
    text: string;

    /** Optional language identifier for syntax highlighting. */
    @maxLength(50)
    language?: string;
  }

  /** An unordered (bullet) list. */
  model BulletListBlock {
    /** The list items. */
    @required
    items: ListItem[];
  }

  /** An ordered (numbered) list. */
  model OrderedListBlock {
    /** The list items. */
    @required
    items: ListItem[];

    /** Starting number (default 1). */
    start?: integer;
  }

  /** A single list item with text and optional facets. */
  model ListItem {
    /** The plain text content (no markdown symbols). */
    @maxGraphemes(10000)
    @maxLength(100000)
    text?: string;

    /** Annotations of text (formatting, mentions, links, etc). */
    facets?: com.deckbelcher.richtext.facet.Main[];
  }

  /** A horizontal rule (thematic break). */
  model HorizontalRuleBlock {}
}
