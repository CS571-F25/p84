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
	rule: asRuleNumber("903.3"),
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

			const typeLine = getTypeLine(card).toLowerCase();
			const isCreatureOrVehicle =
				typeLine.includes("creature") || typeLine.includes("vehicle");

			if (!isCreatureOrVehicle) {
				violations.push(
					violation(
						this,
						`${card.name} is not a creature (PDH commanders must be uncommon creatures)`,
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

function isUncommonInPaperOrMtgo(card: Card): boolean {
	if (card.rarity !== "uncommon") return false;

	const games = card.games ?? [];
	return games.includes("paper") || games.includes("mtgo");
}

function getTypeLine(card: Card): string {
	if (card.type_line) {
		return card.type_line;
	}

	if (card.card_faces) {
		return card.card_faces.map((face) => face.type_line ?? "").join(" // ");
	}

	return "";
}
