import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import * as ComDeckbelcherRichtextFacet from "./richtext/facet.js";

const _mainSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext"),
	),
	/**
	 * Annotations of text (mentions, URLs, hashtags, card references, etc).
	 */
	get facets() {
		return /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.array(ComDeckbelcherRichtextFacet.mainSchema),
		);
	},
	/**
	 * The text content.
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

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}
