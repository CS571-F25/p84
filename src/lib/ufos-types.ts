/**
 * Types for UFOs API (ufos-api.microcosm.blue)
 * Provides recent records from the ATProto firehose
 */

import type { Did } from "@atcute/lexicons";
import type { CollectionList } from "./collection-list-types";
import type { Deck } from "./deck-types";
import type {
	ComDeckbelcherCollectionList,
	ComDeckbelcherDeckList,
} from "./lexicons/index";

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
 * Raw deck record from UFOs API (before boundary transformation)
 */
export type UfosRawDeckRecord = UfosRecord<ComDeckbelcherDeckList.Main>;

/**
 * Raw list record from UFOs API (before boundary transformation)
 */
export type UfosRawListRecord = UfosRecord<ComDeckbelcherCollectionList.Main>;

/**
 * Deck record with transformed app types
 */
export type UfosDeckRecord = UfosRecord<Deck> & {
	collection: "com.deckbelcher.deck.list";
};

/**
 * Collection list record with transformed app types
 */
export type UfosListRecord = UfosRecord<CollectionList> & {
	collection: "com.deckbelcher.collection.list";
};

/**
 * Supported collection NSIDs for the activity feed
 */
export type ActivityCollection =
	| "com.deckbelcher.deck.list"
	| "com.deckbelcher.collection.list";
