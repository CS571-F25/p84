import "@typelex/emitter";
import "./externals.tsp";
import "./defs.tsp";
import "./richtext.tsp";

namespace com.deckbelcher.social.comment {
	/** Top-level comment on a card, deck, or collection. */
	@rec("tid")
	model Main {
		/** What this comment is on. */
		@required
		subject: CardSubject | RecordSubject | unknown;

		/** Optional refinement within subject (card/section/tag in a deck). */
		target?: CardTarget | DeckTarget | SectionTarget | TagTarget | unknown;

		/** Rich text content. */
		@required
		content: com.deckbelcher.richtext.Document;

		@required
		createdAt: datetime;

		updatedAt?: datetime;
	}

	/** Subject: a card (global comment on the card itself). */
	model CardSubject {
		@required
		ref: com.deckbelcher.defs.CardRef;
	}

	/** Subject: an ATProto record (deck, collection). */
	model RecordSubject {
		@required
		ref: com.atproto.repo.strongRef.Main;
	}

	/** Target: a card (in a deck or collection). */
	model CardTarget {
		@required
		ref: com.deckbelcher.defs.CardRef;
	}

	/** Target: a deck (in a collection). */
	model DeckTarget {
		@required
		ref: com.atproto.repo.strongRef.Main;
	}

	/** Target: a deck section (mainboard, sideboard, etc). */
	model SectionTarget {
		@required
		@maxGraphemes(64)
		@maxLength(640)
		section: string;
	}

	/** Target: a tag package (ramp, removal, wincons, etc). */
	model TagTarget {
		@required
		@maxGraphemes(64)
		@maxLength(640)
		tag: string;
	}
}
