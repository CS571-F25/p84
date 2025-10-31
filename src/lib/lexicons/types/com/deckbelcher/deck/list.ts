import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComDeckbelcherRichtextFacet from "../richtext/facet.js";

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
	 * Scryfall UUID for the specific printing.
	 */
	scryfallId: /*#__PURE__*/ v.string(),
	/**
	 * Which section of the deck this card belongs to. Extensible to support format-specific sections.
	 */
	section: /*#__PURE__*/ v.string<
		"commander" | "mainboard" | "maybeboard" | "sideboard" | (string & {})
	>(),
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
		 * Format of the deck (e.g., "commander", "cube", "pauper").
		 * @maxLength 320
		 * @maxGraphemes 32
		 */
		format: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringLength(0, 320),
				/*#__PURE__*/ v.stringGraphemes(0, 32),
			]),
		),
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
		 * @maxLength 100000
		 * @maxGraphemes 10000
		 */
		primer: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringLength(0, 100000),
				/*#__PURE__*/ v.stringGraphemes(0, 10000),
			]),
		),
		/**
		 * Annotations of text in the primer (mentions, URLs, hashtags, card references, etc).
		 */
		get primerFacets() {
			return /*#__PURE__*/ v.optional(
				/*#__PURE__*/ v.array(ComDeckbelcherRichtextFacet.mainSchema),
			);
		},
		/**
		 * Timestamp when the decklist was last updated.
		 */
		updatedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
	}),
);

type card$schematype = typeof _cardSchema;
type main$schematype = typeof _mainSchema;

export interface cardSchema extends card$schematype {}
export interface mainSchema extends main$schematype {}

export const cardSchema = _cardSchema as cardSchema;
export const mainSchema = _mainSchema as mainSchema;

export interface Card extends v.InferInput<typeof cardSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
	interface Records {
		"com.deckbelcher.deck.list": mainSchema;
	}
}
