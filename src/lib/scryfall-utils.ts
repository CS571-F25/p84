import type { ImageSize, ScryfallId } from "./scryfall-types";

export type CardFaceType = "front" | "back";

/**
 * Reconstruct Scryfall image URI from card ID
 *
 * Pattern: https://cards.scryfall.io/{size}/front/{id[0]}/{id[1]}/{id}.jpg
 *
 * This works for 100% of sampled cards (96.5% of all cards have images).
 * See .claude/SCRYFALL.md for details.
 */
export function getImageUri(
	scryfallId: ScryfallId,
	size: ImageSize = "normal",
	face: CardFaceType = "front",
): string {
	return `https://cards.scryfall.io/${size}/${face}/${scryfallId[0]}/${scryfallId[1]}/${scryfallId}.jpg`;
}
