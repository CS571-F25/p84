import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import * as ComDeckbelcherRichtextFacet from "./richtext/facet.js";

const _documentSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#document"),
  ),
  /**
   * Array of blocks (paragraphs, headings, etc).
   */
  get content() {
    return /*#__PURE__*/ v.array(
      /*#__PURE__*/ v.variant([headingBlockSchema, paragraphBlockSchema]),
    );
  },
});
const _headingBlockSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#headingBlock"),
  ),
  /**
   * Annotations of text (formatting, mentions, links, etc).
   */
  get facets() {
    return /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.array(ComDeckbelcherRichtextFacet.mainSchema),
    );
  },
  /**
   * Heading level (1-6).
   * @minimum 1
   * @maximum 6
   */
  level: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [
    /*#__PURE__*/ v.integerRange(1, 6),
  ]),
  /**
   * The plain text content (no markdown symbols).
   * @maxLength 10000
   * @maxGraphemes 1000
   */
  text: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 10000),
      /*#__PURE__*/ v.stringGraphemes(0, 1000),
    ]),
  ),
});
const _mainSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext"),
  ),
  /**
   * Annotations of text (mentions, URLs, hashtags, formatting, etc).
   */
  get facets() {
    return /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.array(ComDeckbelcherRichtextFacet.mainSchema),
    );
  },
  /**
   * The plain text content (no markdown symbols).
   * @maxLength 500000
   * @maxGraphemes 50000
   */
  text: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 500000),
      /*#__PURE__*/ v.stringGraphemes(0, 50000),
    ]),
  ),
});
const _paragraphBlockSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#paragraphBlock"),
  ),
  /**
   * Annotations of text (formatting, mentions, links, etc).
   */
  get facets() {
    return /*#__PURE__*/ v.optional(
      /*#__PURE__*/ v.array(ComDeckbelcherRichtextFacet.mainSchema),
    );
  },
  /**
   * The plain text content (no markdown symbols).
   * @maxLength 500000
   * @maxGraphemes 50000
   */
  text: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 500000),
      /*#__PURE__*/ v.stringGraphemes(0, 50000),
    ]),
  ),
});

type document$schematype = typeof _documentSchema;
type headingBlock$schematype = typeof _headingBlockSchema;
type main$schematype = typeof _mainSchema;
type paragraphBlock$schematype = typeof _paragraphBlockSchema;

export interface documentSchema extends document$schematype {}
export interface headingBlockSchema extends headingBlock$schematype {}
export interface mainSchema extends main$schematype {}
export interface paragraphBlockSchema extends paragraphBlock$schematype {}

export const documentSchema = _documentSchema as documentSchema;
export const headingBlockSchema = _headingBlockSchema as headingBlockSchema;
export const mainSchema = _mainSchema as mainSchema;
export const paragraphBlockSchema =
  _paragraphBlockSchema as paragraphBlockSchema;

export interface Document extends v.InferInput<typeof documentSchema> {}
export interface HeadingBlock extends v.InferInput<typeof headingBlockSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}
export interface ParagraphBlock
  extends v.InferInput<typeof paragraphBlockSchema> {}
