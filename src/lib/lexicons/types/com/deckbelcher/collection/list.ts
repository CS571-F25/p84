import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComDeckbelcherDefs from "../defs.js";
import * as ComDeckbelcherRichtext from "../richtext.js";

const _cardItemSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.collection.list#cardItem"),
  ),
  /**
   * Timestamp when this item was added to the list.
   */
  addedAt: /*#__PURE__*/ v.datetimeString(),
  /**
   * Reference to the card (scryfall printing + oracle card).
   */
  get ref() {
    return ComDeckbelcherDefs.cardRefSchema;
  },
});
const _deckItemSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.collection.list#deckItem"),
  ),
  /**
   * Timestamp when this item was added to the list.
   */
  addedAt: /*#__PURE__*/ v.datetimeString(),
  /**
   * AT-URI of the deck record.
   */
  deckUri: /*#__PURE__*/ v.resourceUriString(),
});
const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("com.deckbelcher.collection.list"),
    /**
     * Timestamp when the list was created.
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * Description of the list.
     */
    get description() {
      return /*#__PURE__*/ v.optional(ComDeckbelcherRichtext.documentSchema);
    },
    /**
     * Items in the list.
     */
    get items() {
      return /*#__PURE__*/ v.array(
        /*#__PURE__*/ v.variant([cardItemSchema, deckItemSchema]),
      );
    },
    /**
     * Name of the list.
     * @maxLength 1280
     * @maxGraphemes 128
     */
    name: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
      /*#__PURE__*/ v.stringLength(0, 1280),
      /*#__PURE__*/ v.stringGraphemes(0, 128),
    ]),
    /**
     * Timestamp when the list was last updated.
     */
    updatedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
  }),
);

type cardItem$schematype = typeof _cardItemSchema;
type deckItem$schematype = typeof _deckItemSchema;
type main$schematype = typeof _mainSchema;

export interface cardItemSchema extends cardItem$schematype {}
export interface deckItemSchema extends deckItem$schematype {}
export interface mainSchema extends main$schematype {}

export const cardItemSchema = _cardItemSchema as cardItemSchema;
export const deckItemSchema = _deckItemSchema as deckItemSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface CardItem extends v.InferInput<typeof cardItemSchema> {}
export interface DeckItem extends v.InferInput<typeof deckItemSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "com.deckbelcher.collection.list": mainSchema;
  }
}
