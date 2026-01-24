import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComAtprotoRepoStrongRef from "../../atproto/repo/strongRef.js";
import * as ComDeckbelcherDefs from "../defs.js";
import * as ComDeckbelcherRichtext from "../richtext.js";

const _cardSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.deck.list#card"),
  ),
  /**
   * Number of copies in the deck.
   * @minimum 1
   */
  quantity: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.integer(), [
    /*#__PURE__*/ v.integerRange(1),
  ]),
  /**
   * Reference to the card (scryfall printing + oracle card).
   */
  get ref() {
    return ComDeckbelcherDefs.cardRefSchema;
  },
  /**
   * Which section of the deck this card belongs to. Extensible to support format-specific sections.
   */
  get section() {
    return sectionSchema;
  },
  /**
   * User annotations for this card in this deck (e.g., "removal", "wincon", "ramp").
   * @maxLength 128
   */
  tags: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.constrain(
      /*#__PURE__*/ v.array(
        /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
          /*#__PURE__*/ v.stringLength(0, 640),
          /*#__PURE__*/ v.stringGraphemes(0, 64),
        ]),
      ),
      [/*#__PURE__*/ v.arrayLength(0, 128)],
    ),
  ),
});
const _formatSchema = /*#__PURE__*/ v.constrain(
  /*#__PURE__*/ v.string<
    | "alchemy"
    | "brawl"
    | "commander"
    | "cube"
    | "draft"
    | "duel"
    | "gladiator"
    | "historic"
    | "kitchentable"
    | "legacy"
    | "modern"
    | "oathbreaker"
    | "oldschool"
    | "pauper"
    | "paupercommander"
    | "penny"
    | "pioneer"
    | "predh"
    | "premodern"
    | "standard"
    | "standardbrawl"
    | "timeless"
    | "vintage"
    | (string & {})
  >(),
  [
    /*#__PURE__*/ v.stringLength(0, 320),
    /*#__PURE__*/ v.stringGraphemes(0, 32),
  ],
);
const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("com.deckbelcher.deck.list"),
    /**
     * Array of cards in the decklist.
     */
    get cards() {
      return /*#__PURE__*/ v.array(cardSchema);
    },
    /**
     * Timestamp when the decklist was created.
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Format of the deck.
     */
    get format() {
      return /*#__PURE__*/ v.optional(formatSchema);
    },
    /**
     * Name of the decklist.
     * @maxLength 1280
     * @maxGraphemes 128
     */
    name: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 1280),
      /*#__PURE__*/ v.stringGraphemes(0, 128),
    ]),
    /**
     * Deck primer with strategy, combos, and card choices.
     */
    get primer() {
      return /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.variant([
          primerRefSchema,
          primerUriSchema,
          ComDeckbelcherRichtext.documentSchema,
        ]),
      );
    },
    /**
     * Timestamp when the decklist was last updated.
     */
    updatedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
  }),
);
const _primerRefSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.deck.list#primerRef"),
  ),
  get ref() {
    return ComAtprotoRepoStrongRef.mainSchema;
  },
});
const _primerUriSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.deck.list#primerUri"),
  ),
  /**
   * @maxLength 10000
   * @maxGraphemes 1000
   */
  uri: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
    /*#__PURE__*/ v.stringLength(0, 10000),
    /*#__PURE__*/ v.stringGraphemes(0, 1000),
  ]),
});
const _sectionSchema = /*#__PURE__*/ v.constrain(
  /*#__PURE__*/ v.string<
    "commander" | "mainboard" | "maybeboard" | "sideboard" | (string & {})
  >(),
  [
    /*#__PURE__*/ v.stringLength(0, 640),
    /*#__PURE__*/ v.stringGraphemes(0, 64),
  ],
);

type card$schematype = typeof _cardSchema;
type format$schematype = typeof _formatSchema;
type main$schematype = typeof _mainSchema;
type primerRef$schematype = typeof _primerRefSchema;
type primerUri$schematype = typeof _primerUriSchema;
type section$schematype = typeof _sectionSchema;

export interface cardSchema extends card$schematype {}
export interface formatSchema extends format$schematype {}
export interface mainSchema extends main$schematype {}
export interface primerRefSchema extends primerRef$schematype {}
export interface primerUriSchema extends primerUri$schematype {}
export interface sectionSchema extends section$schematype {}

export const cardSchema = _cardSchema as cardSchema;
export const formatSchema = _formatSchema as formatSchema;
export const mainSchema = _mainSchema as mainSchema;
export const primerRefSchema = _primerRefSchema as primerRefSchema;
export const primerUriSchema = _primerUriSchema as primerUriSchema;
export const sectionSchema = _sectionSchema as sectionSchema;

export interface Card extends v.InferInput<typeof cardSchema> {}
export type Format = v.InferInput<typeof formatSchema>;
export interface Main extends v.InferInput<typeof mainSchema> {}
export interface PrimerRef extends v.InferInput<typeof primerRefSchema> {}
export interface PrimerUri extends v.InferInput<typeof primerUriSchema> {}
export type Section = v.InferInput<typeof sectionSchema>;

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "com.deckbelcher.deck.list": mainSchema;
  }
}
