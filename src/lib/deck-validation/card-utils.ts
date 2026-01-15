/**
 * Public card utility functions for use outside deck-validation.
 * Re-exports semantic predicates from validation rules.
 */

import type { Card } from "@/lib/scryfall-types";
import {
	getPartnerInfo,
	isDoctor,
	isValidCommanderType,
	type PartnerInfo,
} from "./rules/commander";

export type { PartnerInfo };
export { getPartnerInfo, isDoctor, isValidCommanderType };

/**
 * Alias for isValidCommanderType - checks if a card can be used as a commander.
 */
export const canBeCommander = isValidCommanderType;

/**
 * Check if a card has any multi-commander mechanic.
 * This includes Partner, Friends Forever, Background, Doctor's Companion, etc.
 */
export function hasPartnerMechanic(card: Card): boolean {
	const info = getPartnerInfo(card);
	return (
		info.hasGenericPartner ||
		info.hasFriendsForever ||
		info.partnerWithName !== null ||
		info.choosesBackground ||
		info.isBackground ||
		info.hasDoctorsCompanion
	);
}
