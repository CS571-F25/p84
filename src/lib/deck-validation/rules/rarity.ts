import { getCardsInSection } from "@/lib/deck-types";
import type { Card } from "@/lib/scryfall-types";
import {
	asRuleNumber,
	type Rule,
	type ValidationContext,
	type Violation,
	violation,
} from "../types";

/**
 * Commander must be uncommon (Pauper Commander / PDH)
 *
 * PDH rules:
 * - Commander must have been printed at uncommon in paper or MTGO
 * - Arena-only downshifts don't count
 * - Any printing of the card can be used if it has a valid uncommon printing
 * - Commander doesn't need to be legendary (just uncommon creature)
 */
export const commanderUncommonRule: Rule<"commanderUncommon"> = {
	id: "commanderUncommon",
	rule: asRuleNumber("903.3"),
	category: "structure",
	description: "Commander must have an uncommon printing in paper/MTGO (PDH)",
	validate(ctx: ValidationContext): Violation[] {
		const { deck, getPrintings } = ctx;
		const violations: Violation[] = [];
		const commanders = getCardsInSection(deck, "commander");

		for (const entry of commanders) {
			const printings = getPrintings(entry.oracleId);
			const hasValidUncommon = printings.some((card) =>
				isUncommonInPaperOrMtgo(card),
			);

			if (!hasValidUncommon) {
				const card = printings[0];
				const name = card?.name ?? "Unknown card";
				violations.push(
					violation(
						this,
						`${name} has no uncommon printing in paper/MTGO`,
						"error",
						{
							cardName: name,
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

function isUncommonInPaperOrMtgo(card: Card): boolean {
	if (card.rarity !== "uncommon") return false;

	const games = card.games ?? [];
	return games.includes("paper") || games.includes("mtgo");
}
