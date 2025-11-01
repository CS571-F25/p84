import type {} from "@atcute/lexicons";
import type {} from "@atcute/lexicons/ambient";
import * as v from "@atcute/lexicons/validations";
import * as ComDeckbelcherRichtextFacet from "../richtext/facet.js";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.literal("self"),
	/*#__PURE__*/ v.object({
		$type: /*#__PURE__*/ v.literal("com.deckbelcher.actor.profile"),
		/**
		 * Timestamp when the profile was created.
		 */
		createdAt: /*#__PURE__*/ v.datetimeString(),
		/**
		 * Free-form profile description.
		 * @maxLength 2560
		 * @maxGraphemes 256
		 */
		description: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringLength(0, 2560),
				/*#__PURE__*/ v.stringGraphemes(0, 256),
			]),
		),
		/**
		 * Annotations of text in the profile description (mentions, URLs, hashtags, etc).
		 */
		get descriptionFacets() {
			return /*#__PURE__*/ v.optional(
				/*#__PURE__*/ v.array(ComDeckbelcherRichtextFacet.mainSchema),
			);
		},
		/**
		 * User's display name.
		 * @maxLength 640
		 * @maxGraphemes 64
		 */
		displayName: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringLength(0, 640),
				/*#__PURE__*/ v.stringGraphemes(0, 64),
			]),
		),
		/**
		 * Free-form pronouns text.
		 * @maxLength 200
		 * @maxGraphemes 20
		 */
		pronouns: /*#__PURE__*/ v.optional(
			/*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
				/*#__PURE__*/ v.stringLength(0, 200),
				/*#__PURE__*/ v.stringGraphemes(0, 20),
			]),
		),
	}),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
	interface Records {
		"com.deckbelcher.actor.profile": mainSchema;
	}
}
