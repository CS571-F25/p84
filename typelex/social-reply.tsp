import "@typelex/emitter";
import "./externals.tsp";
import "./richtext.tsp";

namespace com.deckbelcher.social.reply {
	/** Reply to a comment or another reply. */
	@rec("tid")
	model Main {
		/** The comment or reply being replied to. */
		@required
		parent: com.atproto.repo.strongRef.Main;

		/** The root top-level comment (for efficient thread loading). */
		@required
		root: com.atproto.repo.strongRef.Main;

		/** Rich text content. */
		@required
		content: com.deckbelcher.richtext.Document;

		@required
		createdAt: datetime;

		updatedAt?: datetime;
	}
}
