import { getCardsInSection } from "@/lib/deck-types";
import type { Card } from "@/lib/scryfall-types";
import {
	asRuleNumber,
	type Rule,
	type ValidationContext,
	type Violation,
	violation,
} from "../types";
import { hasCommanderCreatureType } from "./commander";

/**
 * Commander must be uncommon creature (Pauper Commander / PDH)
 *
 * PDH rules:
 * - Commander must be a creature (or vehicle, since they can be commanders)
 * - Commander must have been printed at uncommon in paper or MTGO
 * - Arena-only downshifts don't count
 * - Any printing of the card can be used if it has a valid uncommon printing
 * - Commander doesn't need to be legendary (just uncommon creature)
 */
export const commanderUncommonRule: Rule<"commanderUncommon"> = {
	id: "commanderUncommon",
	rule: asRuleNumber("PDH"),
	ruleText:
		"The commander must be an uncommon creature, vehicle, or spacecraft and does not need to be legendary. (pdhhomebase.com/rules)",
	category: "structure",
	description:
		"Commander must be an uncommon creature with printing in paper/MTGO (PDH)",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, cardLookup, getPrintings } = ctx;
		const violations: Violation[] = [];
		const commanders = getCardsInSection(deck, "commander");

		for (const entry of commanders) {
			const card = cardLookup(entry.scryfallId);
			if (!card) continue;

			if (!hasCommanderCreatureType(card)) {
				violations.push(
					violation(
						this,
						`${card.name} is not a creature, vehicle, or spacecraft (PDH commanders must be uncommon)`,
						"error",
						{
							cardName: card.name,
							oracleId: entry.oracleId,
							section: "commander",
						},
					),
				);
				continue;
			}

			const printings = getPrintings(entry.oracleId);
			const hasValidUncommon = printings.some((p) =>
				isUncommonInPaperOrMtgo(p),
			);

			if (!hasValidUncommon) {
				violations.push(
					violation(
						this,
						`${card.name} has no uncommon printing in paper/MTGO`,
						"error",
						{
							cardName: card.name,
							oracleId: entry.oracleId,
							section: "commander",
						},
					),
				);
			}
		}

		return violations;
	},
};

export function isUncommonInPaperOrMtgo(card: Card): boolean {
	if (card.rarity !== "uncommon") return false;

	const games = card.games ?? [];
	return games.includes("paper") || games.includes("mtgo");
}

/**
 * Check if this printing can be a Pauper Commander (PDH).
 * Must be creature/vehicle/spacecraft (with P/T for spacecraft) and uncommon in paper/MTGO.
 *
 * Note: Full validation checks ALL printings of a card. This predicate
 * only checks the current printing, suitable for search filtering.
 */
export function canBePauperCommander(card: Card): boolean {
	return hasCommanderCreatureType(card) && isUncommonInPaperOrMtgo(card);
}
