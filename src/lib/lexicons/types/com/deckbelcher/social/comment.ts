import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";
import type {} from "@atcute/lexicons/ambient";
import * as ComAtprotoRepoStrongRef from "../../atproto/repo/strongRef.js";
import * as ComDeckbelcherDefs from "../defs.js";
import * as ComDeckbelcherRichtext from "../richtext.js";

const _cardSubjectSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.comment#cardSubject"),
  ),
  get ref() {
    return ComDeckbelcherDefs.cardRefSchema;
  },
});
const _cardTargetSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.comment#cardTarget"),
  ),
  get ref() {
    return ComDeckbelcherDefs.cardRefSchema;
  },
});
const _deckTargetSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.comment#deckTarget"),
  ),
  get ref() {
    return ComAtprotoRepoStrongRef.mainSchema;
  },
});
const _mainSchema = /*#__PURE__*/ v.record(
  /*#__PURE__*/ v.tidString(),
  /*#__PURE__*/ v.object({
    $type: /*#__PURE__*/ v.literal("com.deckbelcher.social.comment"),
    /**
     * Rich text content.
     */
    get content() {
      return ComDeckbelcherRichtext.documentSchema;
    },
    createdAt: /*#__PURE__*/ v.datetimeString(),
    /**
     * What this comment is on.
     */
    get subject() {
      return /*#__PURE__*/ v.variant([cardSubjectSchema, recordSubjectSchema]);
    },
    /**
     * Optional refinement within subject (card/section/tag in a deck).
     */
    get target() {
      return /*#__PURE__*/ v.optional(
        /*#__PURE__*/ v.variant([
          cardTargetSchema,
          deckTargetSchema,
          sectionTargetSchema,
          tagTargetSchema,
        ]),
      );
    },
    updatedAt: /*#__PURE__*/ v.optional(/*#__PURE__*/ v.datetimeString()),
  }),
);
const _recordSubjectSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.comment#recordSubject"),
  ),
  get ref() {
    return ComAtprotoRepoStrongRef.mainSchema;
  },
});
const _sectionTargetSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.comment#sectionTarget"),
  ),
  /**
   * @maxLength 640
   * @maxGraphemes 64
   */
  section: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
    /*#__PURE__*/ v.stringLength(0, 640),
    /*#__PURE__*/ v.stringGraphemes(0, 64),
  ]),
});
const _tagTargetSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.social.comment#tagTarget"),
  ),
  /**
   * @maxLength 640
   * @maxGraphemes 64
   */
  tag: /*#__PURE__*/ v.constrain(/*#__PURE__*/ v.string(), [
    /*#__PURE__*/ v.stringLength(0, 640),
    /*#__PURE__*/ v.stringGraphemes(0, 64),
  ]),
});

type cardSubject$schematype = typeof _cardSubjectSchema;
type cardTarget$schematype = typeof _cardTargetSchema;
type deckTarget$schematype = typeof _deckTargetSchema;
type main$schematype = typeof _mainSchema;
type recordSubject$schematype = typeof _recordSubjectSchema;
type sectionTarget$schematype = typeof _sectionTargetSchema;
type tagTarget$schematype = typeof _tagTargetSchema;

export interface cardSubjectSchema extends cardSubject$schematype {}
export interface cardTargetSchema extends cardTarget$schematype {}
export interface deckTargetSchema extends deckTarget$schematype {}
export interface mainSchema extends main$schematype {}
export interface recordSubjectSchema extends recordSubject$schematype {}
export interface sectionTargetSchema extends sectionTarget$schematype {}
export interface tagTargetSchema extends tagTarget$schematype {}

export const cardSubjectSchema = _cardSubjectSchema as cardSubjectSchema;
export const cardTargetSchema = _cardTargetSchema as cardTargetSchema;
export const deckTargetSchema = _deckTargetSchema as deckTargetSchema;
export const mainSchema = _mainSchema as mainSchema;
export const recordSubjectSchema = _recordSubjectSchema as recordSubjectSchema;
export const sectionTargetSchema = _sectionTargetSchema as sectionTargetSchema;
export const tagTargetSchema = _tagTargetSchema as tagTargetSchema;

export interface CardSubject extends v.InferInput<typeof cardSubjectSchema> {}
export interface CardTarget extends v.InferInput<typeof cardTargetSchema> {}
export interface DeckTarget extends v.InferInput<typeof deckTargetSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}
export interface RecordSubject
  extends v.InferInput<typeof recordSubjectSchema> {}
export interface SectionTarget
  extends v.InferInput<typeof sectionTargetSchema> {}
export interface TagTarget extends v.InferInput<typeof tagTargetSchema> {}

declare module "@atcute/lexicons/ambient" {
  interface Records {
    "com.deckbelcher.social.comment": mainSchema;
  }
}
