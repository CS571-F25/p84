import type {} from "@atcute/lexicons";
import * as v from "@atcute/lexicons/validations";

const _cardRefSchema = /*#__PURE__*/ v.object({
  $type: /*#__PURE__*/ v.optional(
    /*#__PURE__*/ v.literal("com.deckbelcher.defs#cardRef"),
  ),
  /**
   * Oracle card URI (oracle:<uuid>) - for external indexing. Derived from scryfallUri; on conflict, scryfallUri takes precedence.
   */
  oracleUri: /*#__PURE__*/ v.genericUriString(),
  /**
   * Scryfall printing URI (scry:<uuid>) - authoritative identifier
   */
  scryfallUri: /*#__PURE__*/ v.genericUriString(),
});

type cardRef$schematype = typeof _cardRefSchema;

export interface cardRefSchema extends cardRef$schematype {}

export const cardRefSchema = _cardRefSchema as cardRefSchema;

export interface CardRef extends v.InferInput<typeof cardRefSchema> {}
