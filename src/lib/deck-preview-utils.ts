/**
 * Irregular plurals relevant to MTG typal deck names.
 * These can't be derived algorithmically.
 */
const IRREGULAR_PLURALS: Record<string, string[]> = {
	geese: ["goose"],
	teeth: ["tooth"],
	feet: ["foot"],
	men: ["man"],
	mice: ["mouse"],
	children: ["child"],
	oxen: ["ox"],
	people: ["person"],
};

/**
 * Get possible singular forms of a word for matching deck names to card names.
 * Handles common English plural patterns used in MTG typal deck names.
 */
export function getSingularForms(word: string): string[] {
	const forms = [word];

	// Check irregular plurals first
	const irregular = IRREGULAR_PLURALS[word];
	if (irregular) {
		forms.push(...irregular);
		return forms;
	}

	if (word.endsWith("ies") && word.length > 3) {
		forms.push(`${word.slice(0, -3)}y`); // pixies -> pixy
		forms.push(word.slice(0, -1)); // faeries -> faerie
	} else if (word.endsWith("ves") && word.length > 3) {
		forms.push(`${word.slice(0, -3)}f`); // elves -> elf
		forms.push(`${word.slice(0, -3)}fe`); // knives -> knife
	} else if (
		word.length > 2 &&
		(word.endsWith("xes") ||
			word.endsWith("sses") ||
			word.endsWith("ches") ||
			word.endsWith("shes") ||
			word.endsWith("zzes"))
	) {
		forms.push(word.slice(0, -2)); // boxes -> box, passes -> pass
	} else if (word.endsWith("s") && !word.endsWith("ss") && word.length > 1) {
		// Skip words ending in -ss (prowess, boss, moss) - not plurals
		forms.push(word.slice(0, -1)); // bogles -> bogle, goblins -> goblin
	}
	return forms;
}

/**
 * Extract meaningful words from a deck name for matching against card names/text.
 * Returns lowercase words (3+ chars) plus their possible singular forms.
 */
export function getDeckNameWords(name: string): string[] {
	return name
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length >= 3)
		.flatMap(getSingularForms);
}

/**
 * Check if text contains any of the deck title words.
 */
export function textMatchesDeckTitle(
	text: string | undefined,
	deckWords: string[],
): boolean {
	if (!text || deckWords.length === 0) return false;
	const lower = text.toLowerCase();
	return deckWords.some((word) => lower.includes(word));
}

/**
 * Check if a type line represents a non-creature land.
 */
export function isNonCreatureLand(typeLine: string | undefined): boolean {
	if (!typeLine) return false;
	const lower = typeLine.toLowerCase();
	return lower.includes("land") && !lower.includes("creature");
}
