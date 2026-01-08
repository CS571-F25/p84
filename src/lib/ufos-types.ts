/**
 * Types for UFOs API (ufos-api.microcosm.blue)
 * Provides recent records from the ATProto firehose
 */

import type { Did } from "@atcute/lexicons";
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
 * Deck record from UFOs API
 */
export type UfosDeckRecord = UfosRecord<ComDeckbelcherDeckList.Main>;

/**
 * Collection list record from UFOs API
 */
export type UfosListRecord = UfosRecord<ComDeckbelcherCollectionList.Main>;

/**
 * Supported collection NSIDs for the activity feed
 */
export type ActivityCollection =
	| "com.deckbelcher.deck.list"
	| "com.deckbelcher.collection.list";
