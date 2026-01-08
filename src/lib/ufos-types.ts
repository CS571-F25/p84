/**
 * Types for UFOs API (ufos-api.microcosm.blue)
 * Provides recent records from the ATProto firehose
 */

import type { Did } from "@atcute/lexicons";
import type { ComDeckbelcherDeckList } from "./lexicons/index";

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
 * Supported collection NSIDs for the activity feed
 */
export type ActivityCollection = "com.deckbelcher.deck.list";
// Future: | "com.deckbelcher.social.comment" | "com.deckbelcher.social.like"
