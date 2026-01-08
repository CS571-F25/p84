import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";

const _boldSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#bold"),
	),
});
const _byteSliceSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#byteSlice"),
	),
	/**
	 * @minimum 0
	 */
	byteEnd: /*#__PURE__*/ v.integer(),
	/**
	 * @minimum 0
	 */
	byteStart: /*#__PURE__*/ v.integer(),
});
const _codeSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#code"),
	),
});
const _codeBlockSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#codeBlock"),
	),
});
const _italicSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#italic"),
	),
});
const _linkSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#link"),
	),
	uri: /*#__PURE__*/ v.genericUriString(),
});
const _mainSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet"),
	),
	get features() {
		return /*#__PURE__*/ v.array(
			/*#__PURE__*/ v.variant([
				boldSchema,
				codeSchema,
				codeBlockSchema,
				italicSchema,
				linkSchema,
				mentionSchema,
				tagSchema,
			]),
		);
	},
	get index() {
		return byteSliceSchema;
	},
});
const _mentionSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#mention"),
	),
	did: /*#__PURE__*/ v.didString(),
});
const _tagSchema = /*#__PURE__*/ v.object({
	$type: /*#__PURE__*/ v.optional(
		/*#__PURE__*/ v.literal("com.deckbelcher.richtext.facet#tag"),
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

type bold$schematype = typeof _boldSchema;
type byteSlice$schematype = typeof _byteSliceSchema;
type code$schematype = typeof _codeSchema;
type codeBlock$schematype = typeof _codeBlockSchema;
type italic$schematype = typeof _italicSchema;
type link$schematype = typeof _linkSchema;
type main$schematype = typeof _mainSchema;
type mention$schematype = typeof _mentionSchema;
type tag$schematype = typeof _tagSchema;

export interface boldSchema extends bold$schematype {}
export interface byteSliceSchema extends byteSlice$schematype {}
export interface codeSchema extends code$schematype {}
export interface codeBlockSchema extends codeBlock$schematype {}
export interface italicSchema extends italic$schematype {}
export interface linkSchema extends link$schematype {}
export interface mainSchema extends main$schematype {}
export interface mentionSchema extends mention$schematype {}
export interface tagSchema extends tag$schematype {}

export const boldSchema = _boldSchema as boldSchema;
export const byteSliceSchema = _byteSliceSchema as byteSliceSchema;
export const codeSchema = _codeSchema as codeSchema;
export const codeBlockSchema = _codeBlockSchema as codeBlockSchema;
export const italicSchema = _italicSchema as italicSchema;
export const linkSchema = _linkSchema as linkSchema;
export const mainSchema = _mainSchema as mainSchema;
export const mentionSchema = _mentionSchema as mentionSchema;
export const tagSchema = _tagSchema as tagSchema;

export interface Bold extends v.InferInput<typeof boldSchema> {}
export interface ByteSlice extends v.InferInput<typeof byteSliceSchema> {}
export interface Code extends v.InferInput<typeof codeSchema> {}
export interface CodeBlock extends v.InferInput<typeof codeBlockSchema> {}
export interface Italic extends v.InferInput<typeof italicSchema> {}
export interface Link extends v.InferInput<typeof linkSchema> {}
export interface Main extends v.InferInput<typeof mainSchema> {}
export interface Mention extends v.InferInput<typeof mentionSchema> {}
export interface Tag extends v.InferInput<typeof tagSchema> {}
