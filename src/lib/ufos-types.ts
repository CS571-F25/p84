/**
 * Types for UFOs API (ufos-api.microcosm.blue)
 * Provides recent records from the ATProto firehose
 */

import type { Did } from "@atcute/lexicons";
import type { CollectionList } from "./collection-list-types";
import type {
	COLLECTION_LIST_NSID,
	DECK_LIST_NSID,
} from "./constellation-client";
import type { Deck } from "./deck-types";

/**
 * A record from the UFOs API firehose
 */
export interface UfosRecord<T = unknown> {
	did: Did;
	collection: string;
	rkey: string;
	record: T;
	/** Timestamp in microseconds since epoch */
	time_us: number;
}

/**
 * Deck record with transformed app types
 */
export type UfosDeckRecord = UfosRecord<Deck> & {
	collection: typeof DECK_LIST_NSID;
};

/**
 * Collection list record with transformed app types
 */
export type UfosListRecord = UfosRecord<CollectionList> & {
	collection: typeof COLLECTION_LIST_NSID;
};

/**
 * Supported collection NSIDs for the activity feed
 */
export type ActivityCollection =
	| typeof DECK_LIST_NSID
	| typeof COLLECTION_LIST_NSID;
