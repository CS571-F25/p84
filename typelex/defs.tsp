import "@typelex/emitter";

namespace com.deckbelcher.defs {
	/** Reference to a Magic: The Gathering card with printing and oracle identifiers. */
	model CardRef {
		/** Scryfall printing URI (scry:<uuid>) - authoritative identifier */
		@required
		scryfallUri: uri;

		/** Oracle card URI (oracle:<uuid>) - for external indexing.
		 *  Derived from scryfallUri; on conflict, scryfallUri takes precedence. */
		@required
		oracleUri: uri;
	}
}
