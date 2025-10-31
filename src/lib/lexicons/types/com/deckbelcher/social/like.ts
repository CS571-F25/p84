import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComAtprotoRepoStrongRef from "../../atproto/repo/strongRef.js";

const _mainSchema = /*#__PURE__*/ v.record(
	/*#__PURE__*/ v.tidString(),
	/*#__PURE__*/ v.object({
		$type: /*#__PURE__*/ v.literal("com.deckbelcher.social.like"),
		/**
		 * Timestamp when the like was created.
		 */
		createdAt: /*#__PURE__*/ v.datetimeString(),
		/**
		 * Reference to the content being liked.
		 */
		get subject() {
			return ComAtprotoRepoStrongRef.mainSchema;
		},
	}),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
	interface Records {
		"com.deckbelcher.social.like": mainSchema;
	}
}
