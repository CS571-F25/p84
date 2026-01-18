import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComDeckbelcherRichtext from "../richtext.js";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.literal("self"),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("com.deckbelcher.actor.profile"),
    /**
     * Profile bio/description as a rich text document.
     */
    get bio() {
      return /*#__PURE__*/ v.optional(ComDeckbelcherRichtext.documentSchema);
    },
    /**
     * Timestamp when the profile was created.
     */
    createdAt: /*#__PURE__*/ v.datetimeString(),
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
