import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComAtprotoRepoStrongRef from "../../atproto/repo/strongRef.js";
import * as ComDeckbelcherDefs from "../defs.js";

const _cardSubjectSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.like#cardSubject"),
  ),
  /**
   * Reference to the card.
   */
  get ref() {
    return ComDeckbelcherDefs.cardRefSchema;
  },
});
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
      return /*#__PURE__*/ v.variant([cardSubjectSchema, recordSubjectSchema]);
    },
  }),
);
const _recordSubjectSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.like#recordSubject"),
  ),
  /**
   * Reference to the record.
   */
  get ref() {
    return ComAtprotoRepoStrongRef.mainSchema;
  },
});

type cardSubject$schematype = typeof _cardSubjectSchema;
type main$schematype = typeof _mainSchema;
type recordSubject$schematype = typeof _recordSubjectSchema;

export interface cardSubjectSchema extends cardSubject$schematype {}
export interface mainSchema extends main$schematype {}
export interface recordSubjectSchema extends recordSubject$schematype {}

export const cardSubjectSchema = _cardSubjectSchema as cardSubjectSchema;
export const mainSchema = _mainSchema as mainSchema;
export const recordSubjectSchema = _recordSubjectSchema as recordSubjectSchema;

export interface CardSubject extends v.InferInput<typeof cardSubjectSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}
export interface RecordSubject
  extends v.InferInput<typeof recordSubjectSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "com.deckbelcher.social.like": mainSchema;
  }
}
