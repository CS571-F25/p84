/**
 * Shared types for search functionality
 * Centralizes types used by worker, provider, and UI
 */

import type { Card, SearchRestrictions } from "./scryfall-types";

export type SortField = "name" | "mv" | "released" | "rarity" | "color";
export type SortDirection = "asc" | "desc" | "auto";

export interface SortOption {
	field: SortField;
	direction: SortDirection;
}

export interface SearchError {
	message: string;
	start: number;
	end: number;
}

export interface UnifiedSearchResult {
	mode: "fuzzy" | "syntax";
	cards: Card[];
	description: string | null;
	error: SearchError | null;
}

export interface PaginatedSearchResult {
	mode: "fuzzy" | "syntax";
	cards: Card[];
	totalCount: number;
	description: string | null;
	error: SearchError | null;
}

/**
 * Cached search result stored in worker LRU cache
 * Stores full result set without pagination
 */
export interface CachedSearchResult {
	mode: "fuzzy" | "syntax";
	cards: Card[];
	description: string | null;
	error: SearchError | null;
}

export type { Card, SearchRestrictions };
