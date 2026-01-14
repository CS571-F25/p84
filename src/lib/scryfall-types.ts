/**
 * Shared types for Scryfall card data
 *
 * Note: These types represent a filtered subset of Scryfall's full card model,
 * containing only the fields we've chosen to keep for the application.
 */

// Branded types for different ID kinds
export type ScryfallId = string & { readonly __brand: "ScryfallId" };
export type OracleId = string & { readonly __brand: "OracleId" };

// UUID format: 8-4-4-4-12 hex digits
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isScryfallId(id: string): id is ScryfallId {
	return UUID_REGEX.test(id);
}

export function isOracleId(id: string): id is OracleId {
	return UUID_REGEX.test(id);
}

export function asScryfallId(id: string): ScryfallId {
	return id as ScryfallId;
}

export function asOracleId(id: string): OracleId {
	return id as OracleId;
}

// URI scheme prefixes for external indexing
const SCRYFALL_URI_PREFIX = "scry:" as const;
const ORACLE_URI_PREFIX = "oracle:" as const;

export type ScryfallUri = `${typeof SCRYFALL_URI_PREFIX}${string}`;
export type OracleUri = `${typeof ORACLE_URI_PREFIX}${string}`;

/** Convert a ScryfallId to a scry: URI */
export function toScryfallUri(id: ScryfallId): ScryfallUri {
	return `${SCRYFALL_URI_PREFIX}${id}`;
}

/** Convert an OracleId to an oracle: URI */
export function toOracleUri(id: OracleId): OracleUri {
	return `${ORACLE_URI_PREFIX}${id}`;
}

/** Parse a scry: URI and return the ScryfallId, or null if invalid */
export function parseScryfallUri(uri: string): ScryfallId | null {
	if (!uri.startsWith(SCRYFALL_URI_PREFIX)) {
		return null;
	}
	const id = uri.slice(SCRYFALL_URI_PREFIX.length);
	return isScryfallId(id) ? id : null;
}

/** Parse an oracle: URI and return the OracleId, or null if invalid */
export function parseOracleUri(uri: string): OracleId | null {
	if (!uri.startsWith(ORACLE_URI_PREFIX)) {
		return null;
	}
	const id = uri.slice(ORACLE_URI_PREFIX.length);
	return isOracleId(id) ? id : null;
}

export type Rarity =
	| "common"
	| "uncommon"
	| "rare"
	| "mythic"
	| "special"
	| "bonus"
	| string;

export type BorderColor =
	| "black"
	| "white"
	| "borderless"
	| "silver"
	| "gold"
	| string;

export type Frame = "1993" | "1997" | "2003" | "2015" | "future" | string;

export type FrameEffect =
	| "boosterfun"
	| "colorshifted"
	| "companion"
	| "compasslanddfc"
	| "convertdfc"
	| "devoid"
	| "draft"
	| "enchantment"
	| "etched"
	| "extendedart"
	| "fandfc"
	| "fullart"
	| "inverted"
	| "legendary"
	| "lesson"
	| "miracle"
	| "mooneldrazidfc"
	| "originpwdfc"
	| "shatteredglass"
	| "showcase"
	| "snow"
	| "spree"
	| "sunmoondfc"
	| "tombstone"
	| "upsidedowndfc"
	| "wanted"
	| "waxingandwaningmoondfc"
	| string;

export type Layout =
	| "normal"
	| "split"
	| "flip"
	| "transform"
	| "modal_dfc"
	| "meld"
	| "leveler"
	| "class"
	| "saga"
	| "adventure"
	| "mutate"
	| "prototype"
	| "battle"
	| "planar"
	| "scheme"
	| "vanguard"
	| "token"
	| "double_faced_token"
	| "emblem"
	| "augment"
	| "host"
	| "art_series"
	| "reversible_card"
	| string;

export type SetType =
	| "alchemy"
	| "archenemy"
	| "arsenal"
	| "box"
	| "commander"
	| "core"
	| "draft_innovation"
	| "duel_deck"
	| "eternal"
	| "expansion"
	| "from_the_vault"
	| "funny"
	| "masterpiece"
	| "masters"
	| "memorabilia"
	| "minigame"
	| "planechase"
	| "premium_deck"
	| "promo"
	| "spellbook"
	| "starter"
	| "token"
	| "treasure_chest"
	| "vanguard"
	| string;

export type ImageStatus =
	| "missing"
	| "placeholder"
	| "lowres"
	| "highres_scan"
	| string;

export type Finish = "foil" | "nonfoil" | "etched" | string;

export type Game = "paper" | "arena" | "mtgo" | string;

export type Legality = "legal" | "not_legal" | "restricted" | "banned" | string;

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type ManaColorWithColorless = ManaColor | "C";

export type ImageSize =
	| "small"
	| "normal"
	| "large"
	| "png"
	| "art_crop"
	| "border_crop";

export interface SearchRestrictions {
	format?: string; // Formats change over time, keep as string
	colorIdentity?: ManaColor[]; // Card must be subset of these colors
}

export interface CardFace {
	object: string;
	name: string;
	mana_cost?: string;
	type_line?: string;
	oracle_text?: string;
	power?: string;
	toughness?: string;
	loyalty?: string;
	defense?: string;
	colors?: string[];
	flavor_text?: string;
	artist?: string;
	artist_id?: string;
	illustration_id?: string;
	image_uris?: Record<string, string>;
}

export interface Card {
	// Core identity
	id: ScryfallId;
	oracle_id: OracleId;
	name: string;
	type_line?: string;
	mana_cost?: string;
	cmc?: number;
	oracle_text?: string;
	colors?: string[];
	color_identity?: string[];
	keywords?: string[];
	power?: string;
	toughness?: string;
	loyalty?: string;
	defense?: string;
	produced_mana?: string[];

	// Legalities & formats
	legalities?: Record<string, Legality>;
	games?: Game[];
	reserved?: boolean;

	// Search & filtering
	set?: string;
	set_type?: SetType;
	set_name?: string;
	collector_number?: string;
	rarity?: Rarity;
	released_at?: string;
	artist?: string;

	// Printing selection (image_uris omitted - can reconstruct from ID)
	card_faces?: CardFace[];
	border_color?: BorderColor;
	frame?: Frame;
	frame_effects?: FrameEffect[];
	finishes?: Finish[];
	promo?: boolean;
	promo_types?: string[];
	full_art?: boolean;
	digital?: boolean;
	highres_image?: boolean;
	image_status?: ImageStatus;
	layout?: Layout;

	// Nice-to-have
	reprint?: boolean;
	variation?: boolean;
	lang?: string;
	content_warning?: boolean;
}

export interface CardDataOutput {
	version: string;
	cardCount: number;
	cards: Record<ScryfallId, Card>;
	// Sorted by canonical order - first element is the canonical printing
	oracleIdToPrintings: Record<OracleId, ScryfallId[]>;
}

/**
 * Volatile data for a card (prices, EDHREC rank)
 * Stored separately in volatile.bin to avoid cache busting card data
 */
export interface VolatileData {
	edhrecRank: number | null;
	usd: number | null;
	usdFoil: number | null;
	usdEtched: number | null;
	eur: number | null;
	eurFoil: number | null;
	tix: number | null;
}
