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

export type ImageStatus =
	| "missing"
	| "placeholder"
	| "lowres"
	| "highres_scan"
	| string;

export type Finish = "foil" | "nonfoil" | "etched" | string;

export type Game = "paper" | "arena" | "mtgo" | string;

export type Legality = "legal" | "not_legal" | "restricted" | "banned" | string;

export type ImageSize =
	| "small"
	| "normal"
	| "large"
	| "png"
	| "art_crop"
	| "border_crop";

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

	// Legalities & formats
	legalities?: Record<string, Legality>;
	games?: Game[];
	reserved?: boolean;

	// Search & filtering
	set?: string;
	set_name?: string;
	collector_number?: string;
	rarity?: Rarity;
	released_at?: string;
	prices?: Record<string, string | null>;
	artist?: string;

	// Printing selection (image_uris omitted - can reconstruct from ID)
	card_faces?: unknown[];
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
	edhrec_rank?: number;
	reprint?: boolean;
	lang?: string;
	content_warning?: boolean;

	[key: string]: unknown;
}

export interface CardDataOutput {
	version: string;
	cardCount: number;
	cards: Record<ScryfallId, Card>;
	oracleIdToPrintings: Record<OracleId, ScryfallId[]>;
}
