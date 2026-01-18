import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComAtprotoRepoStrongRef from "../../atproto/repo/strongRef.js";
import * as ComDeckbelcherRichtext from "../richtext.js";

const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("com.deckbelcher.social.reply"),
    /**
     * Rich text content.
     */
    get content() {
      return ComDeckbelcherRichtext.documentSchema;
    },
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * The comment or reply being replied to.
     */
    get parent() {
      return ComAtprotoRepoStrongRef.mainSchema;
    },
    /**
     * The root top-level comment (for efficient thread loading).
     */
    get root() {
      return ComAtprotoRepoStrongRef.mainSchema;
    },
    updatedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
  }),
);

type main$schematype = typeof _mainSchema;

export interface mainSchema extends main$schematype {}

export const mainSchema = _mainSchema as mainSchema;

export interface Main extends v.InferInput<typeof mainSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "com.deckbelcher.social.reply": mainSchema;
  }
}
