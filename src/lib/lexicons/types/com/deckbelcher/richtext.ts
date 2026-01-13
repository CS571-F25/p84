import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import * as ComDeckbelcherRichtextFacet from "./richtext/facet.js";

const _bulletListBlockSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#bulletListBlock"),
  ),
  /**
   * The list items.
   */
  get items() {
    return /*#__PURE__*/ v.array(listItemSchema);
  },
});
const _codeBlockSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#codeBlock"),
  ),
  /**
   * Optional language identifier for syntax highlighting.
   * @maxLength 50
   */
  language: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 50),
    ]),
  ),
  /**
   * The code content (plain text, no facets).
   * @maxLength 100000
   */
  text: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
    /*#__PURE__*/ v.stringLength(0, 100000),
  ]),
});
const _documentSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#document"),
  ),
  /**
   * Array of blocks (paragraphs, headings, etc).
   */
  get content() {
    return /*#__PURE__*/ v.array(
      /*#__PURE__*/ v.variant([
        bulletListBlockSchema,
        codeBlockSchema,
        headingBlockSchema,
        horizontalRuleBlockSchema,
        orderedListBlockSchema,
        paragraphBlockSchema,
      ]),
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
const _horizontalRuleBlockSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#horizontalRuleBlock"),
  ),
});
const _listItemSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#listItem"),
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
   * @maxLength 100000
   * @maxGraphemes 10000
   */
  text: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 100000),
      /*#__PURE__*/ v.stringGraphemes(0, 10000),
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
const _orderedListBlockSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.richtext#orderedListBlock"),
  ),
  /**
   * The list items.
   */
  get items() {
    return /*#__PURE__*/ v.array(listItemSchema);
  },
  /**
   * Starting number (default 1).
   */
  start: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.integer()),
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

type bulletListBlock$schematype = typeof _bulletListBlockSchema;
type codeBlock$schematype = typeof _codeBlockSchema;
type document$schematype = typeof _documentSchema;
type headingBlock$schematype = typeof _headingBlockSchema;
type horizontalRuleBlock$schematype = typeof _horizontalRuleBlockSchema;
type listItem$schematype = typeof _listItemSchema;
type main$schematype = typeof _mainSchema;
type orderedListBlock$schematype = typeof _orderedListBlockSchema;
type paragraphBlock$schematype = typeof _paragraphBlockSchema;

export interface bulletListBlockSchema extends bulletListBlock$schematype {}
export interface codeBlockSchema extends codeBlock$schematype {}
export interface documentSchema extends document$schematype {}
export interface headingBlockSchema extends headingBlock$schematype {}
export interface horizontalRuleBlockSchema
  extends horizontalRuleBlock$schematype {}
export interface listItemSchema extends listItem$schematype {}
export interface mainSchema extends main$schematype {}
export interface orderedListBlockSchema extends orderedListBlock$schematype {}
export interface paragraphBlockSchema extends paragraphBlock$schematype {}

export const bulletListBlockSchema =
  _bulletListBlockSchema as bulletListBlockSchema;
export const codeBlockSchema = _codeBlockSchema as codeBlockSchema;
export const documentSchema = _documentSchema as documentSchema;
export const headingBlockSchema = _headingBlockSchema as headingBlockSchema;
export const horizontalRuleBlockSchema =
  _horizontalRuleBlockSchema as horizontalRuleBlockSchema;
export const listItemSchema = _listItemSchema as listItemSchema;
export const mainSchema = _mainSchema as mainSchema;
export const orderedListBlockSchema =
  _orderedListBlockSchema as orderedListBlockSchema;
export const paragraphBlockSchema =
  _paragraphBlockSchema as paragraphBlockSchema;

export interface BulletListBlock
  extends v.InferInput<typeof bulletListBlockSchema> {}
export interface CodeBlock extends v.InferInput<typeof codeBlockSchema> {}
export interface Document extends v.InferInput<typeof documentSchema> {}
export interface HeadingBlock extends v.InferInput<typeof headingBlockSchema> {}
export interface HorizontalRuleBlock
  extends v.InferInput<typeof horizontalRuleBlockSchema> {}
export interface ListItem extends v.InferInput<typeof listItemSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}
export interface OrderedListBlock
  extends v.InferInput<typeof orderedListBlockSchema> {}
export interface ParagraphBlock
  extends v.InferInput<typeof paragraphBlockSchema> {}
